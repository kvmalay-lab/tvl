import React, { useRef, useEffect, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Pose, POSE_CONNECTIONS } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { useNavigate } from 'react-router-dom';
import { useWorkoutHistory } from '../hooks/useWorkoutHistory';
import { Save, Settings, Camera as CameraIcon } from 'lucide-react';
import AICoachChat from '../components/AICoachChat';

// --- Helper Functions (Calculating Angles) ---
function calculateAngle(a, b, c) {
  if (!a || !b || !c) return 0;
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(radians * 180.0 / Math.PI);
  if (angle > 180.0) angle = 360 - angle;
  return Math.round(angle);
}

// Smoothing helper
const smoothAngle = (key, value, bufferRef, windowSize = 5) => {
    if (!bufferRef.current[key]) bufferRef.current[key] = [];
    const buf = bufferRef.current[key];
    buf.push(value);
    if (buf.length > windowSize) buf.shift();
    const sum = buf.reduce((s, v) => s + v, 0);
    return Math.round(sum / buf.length);
};

const WorkoutSession = () => {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const navigate = useNavigate();
  const { saveSession } = useWorkoutHistory();

  // State
  const [exercise, setExercise] = useState('bicep');
  const [reps, setReps] = useState(0);
  const [stage, setStage] = useState(null); // 'up', 'down', etc.
  const [coachCue, setCoachCue] = useState('Get Ready');
  const [webcamReady, setWebcamReady] = useState(false);
  const [calibrating, setCalibrating] = useState(false);

  // Real-time angles for UI
  const [leftAngle, setLeftAngle] = useState(0);
  const [rightAngle, setRightAngle] = useState(0);
  const [leftKneeAngle, setLeftKneeAngle] = useState(0);
  const [rightKneeAngle, setRightKneeAngle] = useState(0);

  // Refs for tracking without re-renders loop
  const repsRef = useRef(0);
  const stageRef = useRef(null);
  const latestAnglesRef = useRef({ leftElbow: 0, rightElbow: 0, leftKnee: 0, rightKnee: 0 });
  const angleBuffersRef = useRef({});
  const latestConfRef = useRef(0);
  const poseRef = useRef(null);
  const cameraRef = useRef(null);

  // Thresholds
  const [thresholds, setThresholds] = useState(() => {
    const saved = localStorage.getItem('tvl_thresholds');
    return saved ? JSON.parse(saved) : { elbowUp: 30, elbowDown: 160, kneeSquat: 100, kneeStand: 160, suggestConf: 0.4 };
  });

  // Save thresholds when changed
  useEffect(() => {
    localStorage.setItem('tvl_thresholds', JSON.stringify(thresholds));
  }, [thresholds]);

  // Use refs for stable access in callbacks
  const exerciseRef = useRef(exercise);
  const thresholdsRef = useRef(thresholds);

  useEffect(() => {
      exerciseRef.current = exercise;
      // Reset logic when exercise changes
      repsRef.current = 0;
      setReps(0);
      stageRef.current = null;
      setStage(null);
      setCoachCue('Get Ready');
      angleBuffersRef.current = {};
  }, [exercise]);

  useEffect(() => { thresholdsRef.current = thresholds; }, [thresholds]);

  const detectExerciseReps = useCallback((mode, angles, t) => {
      const countRep = () => {
          repsRef.current += 1;
          setReps(repsRef.current);
      };

      switch (mode) {
          case 'bicep': {
              const l = angles.leftElbow;
              const r = angles.rightElbow;
              let val = 0;
              if (l && r) val = (l + r) / 2;
              else if (l) val = l;
              else if (r) val = r;

              if (!val) return;

              if (val > t.elbowDown) {
                  stageRef.current = 'down';
                  setStage('down');
                  setCoachCue('Curl Up!');
              } else if (val < t.elbowUp && stageRef.current === 'down') {
                  stageRef.current = 'up';
                  setStage('up');
                  countRep();
                  setCoachCue('Lower Down');
              }
              break;
          }
          case 'squat': {
              const kneeAvg = ((angles.leftKnee || 0) + (angles.rightKnee || 0)) / 2;
              if (kneeAvg === 0) return;

              if (kneeAvg > t.kneeStand) {
                  if (stageRef.current === 'down') countRep();
                  stageRef.current = 'up';
                  setStage('up');
                  setCoachCue('Squat Down!');
              } else if (kneeAvg < t.kneeSquat) {
                  stageRef.current = 'down';
                  setStage('down');
                  setCoachCue('Stand Up!');
              }
              break;
          }
          case 'pushup': {
              const elAvg = ((angles.leftElbow || 0) + (angles.rightElbow || 0)) / 2;
              if (elAvg === 0) return;
              // Up: ~160+, Down: < 90
              if (elAvg > 160) {
                  if (stageRef.current === 'down') countRep();
                  stageRef.current = 'up';
                  setStage('up');
                  setCoachCue('Lower Chest');
              } else if (elAvg < 90) {
                  stageRef.current = 'down';
                  setStage('down');
                  setCoachCue('Push Up');
              }
              break;
          }
          case 'latpulldown': {
              const angle = ((angles.leftElbow || 0) + (angles.rightElbow || 0)) / 2;
              if (!angle) return;
              // Up (arms overhead) ~160+, Pulled down < 80
              if (angle > 150) {
                  if (stageRef.current === 'down') countRep();
                  stageRef.current = 'up';
                  setStage('up');
                  setCoachCue('Pull Down');
              } else if (angle < 80) {
                  stageRef.current = 'down';
                  setStage('down');
                  setCoachCue('Release Up');
              }
              break;
          }
      }
  }, []);

  const stableOnResults = useCallback((results) => {
    if (!results.poseLandmarks) return;

    latestConfRef.current = (results.poseWorldLandmarks ? 0.9 : 0.0);

    // Draw
    const canvas = canvasRef.current;
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, { color: '#6366F1', lineWidth: 4 });
        drawLandmarks(ctx, results.poseLandmarks, { color: '#FCD34D', lineWidth: 2, radius: 4 });
        ctx.restore();
    }

    const landmarks = results.poseLandmarks;

    // Check visibility
    const vis = (i) => (landmarks[i] && typeof landmarks[i].visibility === 'number') ? landmarks[i].visibility : 0;
    const thresh = 0.5;

    let lAngle = 0, rAngle = 0, lKnee = 0, rKnee = 0;

    if (vis(11) > thresh && vis(13) > thresh && vis(15) > thresh) {
        lAngle = calculateAngle(landmarks[11], landmarks[13], landmarks[15]);
        lAngle = smoothAngle('leftElbow', lAngle, angleBuffersRef);
    }
    if (vis(12) > thresh && vis(14) > thresh && vis(16) > thresh) {
        rAngle = calculateAngle(landmarks[12], landmarks[14], landmarks[16]);
        rAngle = smoothAngle('rightElbow', rAngle, angleBuffersRef);
    }
    if (vis(23) > thresh && vis(25) > thresh && vis(27) > thresh) {
        lKnee = calculateAngle(landmarks[23], landmarks[25], landmarks[27]);
        lKnee = smoothAngle('leftKnee', lKnee, angleBuffersRef);
    }
    if (vis(24) > thresh && vis(26) > thresh && vis(28) > thresh) {
        rKnee = calculateAngle(landmarks[24], landmarks[26], landmarks[28]);
        rKnee = smoothAngle('rightKnee', rKnee, angleBuffersRef);
    }

    setLeftAngle(lAngle);
    setRightAngle(rAngle);
    setLeftKneeAngle(lKnee);
    setRightKneeAngle(rKnee);

    latestAnglesRef.current = { leftElbow: lAngle, rightElbow: rAngle, leftKnee: lKnee, rightKnee: rKnee };

    detectExerciseReps(exerciseRef.current, latestAnglesRef.current, thresholdsRef.current);

  }, [detectExerciseReps]);

  // Initialize Pose on mount
  useEffect(() => {
    const pose = new Pose({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}` });
    pose.setOptions({
      modelComplexity: 2,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7
    });
    pose.onResults(stableOnResults);
    poseRef.current = pose;

    return () => {
       pose.close();
    };
  }, [stableOnResults]);

  // Initialize Camera when webcam is ready
  const onUserMedia = useCallback(() => {
    if (webcamRef.current && webcamRef.current.video && poseRef.current && !cameraRef.current) {
        const camera = new Camera(webcamRef.current.video, {
            onFrame: async () => {
                if (webcamRef.current && webcamRef.current.video && poseRef.current) {
                    await poseRef.current.send({ image: webcamRef.current.video });
                }
            },
            width: 1280,
            height: 720
        });
        camera.start();
        cameraRef.current = camera;
        setWebcamReady(true);
    }
  }, []);

  const endSession = () => {
      saveSession({
          date: new Date().toISOString(),
          exercise: exercise,
          reps: reps,
          accuracy: 85 // Using accuracy instead of avgConf as per new schema
      });
      navigate('/');
  };

  // Helper to determine active angle to display
  const getDisplayAngle = () => {
      if (exercise === 'squat') return Math.round((leftKneeAngle + rightKneeAngle) / 2);
      return Math.round((leftAngle + rightAngle) / 2);
  };

  // Helper for cue color
  const getCueColor = () => {
      const cue = coachCue.toLowerCase();
      if (cue.includes('good') || cue.includes('perfect') || cue.includes('great')) return 'bg-green-600';
      if (cue.includes('get ready')) return 'bg-gray-700';
      return 'bg-red-600'; // Corrections
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4 gap-6">

       {/* 1. Header Bar */}
       <div className="w-full max-w-7xl flex justify-between items-center bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-lg">
          <div className="flex gap-4 items-center">
              <span className="text-white font-bold text-lg">FitFlex Arena</span>
              <select
                value={exercise}
                onChange={(e) => setExercise(e.target.value)}
                className="bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 outline-none focus:border-indigo-500"
              >
                  <option value="bicep">Bicep Curl</option>
                  <option value="squat">Squat</option>
                  <option value="pushup">Push-up</option>
                  <option value="latpulldown">Lat Pulldown</option>
              </select>

              <button onClick={() => setCalibrating(!calibrating)} className="bg-gray-700 text-white p-2 rounded-lg border border-gray-600 hover:bg-gray-600">
                  <Settings className="w-5 h-5" />
              </button>
          </div>

          <div>
              <button
                onClick={endSession}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-full font-bold shadow-lg transition-transform hover:scale-105 flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> End Session
              </button>
          </div>
       </div>

       {/* 2. Video Feed (Clean) */}
       <div className="w-full max-w-7xl relative bg-black rounded-xl shadow-2xl overflow-hidden aspect-video border-4 border-gray-800">
           {!webcamReady && (
              <div className="absolute inset-0 flex items-center justify-center text-white z-0">
                  <div className="text-center">
                      <CameraIcon className="w-12 h-12 mx-auto mb-4 animate-pulse" />
                      <p>Initializing Camera...</p>
                  </div>
              </div>
           )}
           <Webcam
             ref={webcamRef}
             className="absolute inset-0 w-full h-full object-contain"
             mirrored={false}
             onUserMedia={onUserMedia}
           />
           <canvas
             ref={canvasRef}
             className="absolute inset-0 w-full h-full object-contain"
             width={1280}
             height={720}
           />
           {/* Calibration Overlay if active */}
           {calibrating && (
             <div className="absolute top-4 right-4 z-20 bg-gray-900/95 backdrop-blur-md p-6 rounded-xl border border-gray-700 w-80 text-sm text-gray-300">
                 <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                    <Settings className="w-4 h-4" /> Calibration
                 </h3>
                 <div className="space-y-4">
                     <div>
                         <label className="block text-xs mb-1">Elbow Up Threshold (Current: {thresholds.elbowUp}°)</label>
                         <input type="range" min="10" max="60" value={thresholds.elbowUp} onChange={e=>setThresholds({...thresholds, elbowUp: parseInt(e.target.value)})} className="w-full accent-indigo-500"/>
                     </div>
                     <div>
                         <label className="block text-xs mb-1">Elbow Down Threshold (Current: {thresholds.elbowDown}°)</label>
                         <input type="range" min="130" max="175" value={thresholds.elbowDown} onChange={e=>setThresholds({...thresholds, elbowDown: parseInt(e.target.value)})} className="w-full accent-indigo-500"/>
                     </div>
                     <button onClick={() => setCalibrating(false)} className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg mt-2">Close</button>
                 </div>
             </div>
           )}
       </div>

       {/* 3. Dashboard Grid (Huge) */}
       <div className="w-full max-w-7xl grid grid-cols-1 md:grid-cols-3 gap-6">
           {/* Card 1: Rep Counter */}
           <div className="bg-gray-800 rounded-2xl p-8 flex flex-col items-center justify-center border border-gray-700 shadow-xl h-64">
               <span className="text-gray-400 font-bold uppercase tracking-wider text-xl mb-2">Total Reps</span>
               <span className="text-9xl font-black text-white leading-none">{reps}</span>
           </div>

           {/* Card 2: AI Coach */}
           <div className={`rounded-2xl p-8 flex flex-col items-center justify-center border border-white/10 shadow-xl h-64 text-center transition-colors duration-500 ${getCueColor()}`}>
               <span className="text-white/80 font-bold uppercase tracking-wider text-xl mb-2">AI Coach</span>
               <span className="text-5xl font-bold text-white leading-tight drop-shadow-md">
                   {coachCue}
               </span>
           </div>

           {/* Card 3: Joint Angle */}
           <div className="bg-gray-800 rounded-2xl p-8 flex flex-col items-center justify-center border border-gray-700 shadow-xl h-64">
               <span className="text-gray-400 font-bold uppercase tracking-wider text-xl mb-2">
                   {exercise === 'squat' ? 'Knee Angle' : 'Elbow Angle'}
               </span>
               <span className="text-7xl font-mono font-bold text-indigo-400">
                   {getDisplayAngle()}°
               </span>
           </div>
       </div>

       {/* Chatbot (Floating, accessible) */}
       <AICoachChat exercise={exercise} coachCue={coachCue} />
    </div>
  );
};

export default WorkoutSession;
