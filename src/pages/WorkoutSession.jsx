import React, { useRef, useEffect, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Pose, POSE_CONNECTIONS } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { useNavigate } from 'react-router-dom';
import { useWorkoutHistory } from '../hooks/useWorkoutHistory';
import { Save, Settings, Camera as CameraIcon } from 'lucide-react';

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
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
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
          avgConf: 85
      });
      navigate('/');
  };

  return (
    <div className="relative h-screen bg-gray-900 flex flex-col">
       {/* Top Bar (Overlay) */}
       <div className="absolute top-0 left-0 right-0 z-20 p-4 flex justify-between items-start pointer-events-none">
          <div className="pointer-events-auto flex gap-4">
              <select
                value={exercise}
                onChange={(e) => setExercise(e.target.value)}
                className="bg-black/60 backdrop-blur-md text-white px-4 py-2 rounded-lg border border-white/10 outline-none focus:border-indigo-500"
              >
                  <option value="bicep">Bicep Curl</option>
                  <option value="squat">Squat</option>
                  <option value="pushup">Push-up</option>
                  <option value="latpulldown">Lat Pulldown</option>
              </select>

              <button onClick={() => setCalibrating(!calibrating)} className="bg-black/60 backdrop-blur-md text-white p-2 rounded-lg border border-white/10 hover:bg-white/10">
                  <Settings className="w-5 h-5" />
              </button>
          </div>

          <div className="pointer-events-auto">
              <button
                onClick={endSession}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-full font-bold shadow-lg transition-transform hover:scale-105 flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> End Session
              </button>
          </div>
       </div>

       {/* Webcam & Canvas Layer */}
       <div className="flex-1 relative overflow-hidden bg-black rounded-xl shadow-2xl">
          {!webcamReady && (
              <div className="absolute inset-0 flex items-center justify-center text-white">
                  <div className="text-center">
                      <CameraIcon className="w-12 h-12 mx-auto mb-4 animate-pulse" />
                      <p>Initializing Camera...</p>
                  </div>
              </div>
          )}
          <Webcam
             ref={webcamRef}
             className="absolute inset-0 w-full h-full object-cover"
             mirrored={false}
             onUserMedia={onUserMedia}
          />
          <canvas
             ref={canvasRef}
             className="absolute inset-0 w-full h-full object-cover"
             width={1280}
             height={720}
          />

          {/* Glassmorphism HUD Overlay - Top Center */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex gap-4">
               <div className="bg-black/40 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 text-center">
                   <p className="text-xs text-gray-300 uppercase tracking-wider font-bold">Reps</p>
                   <p className="text-5xl font-black text-white leading-none mt-1">{reps}</p>
               </div>
               <div className="bg-black/40 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 text-center min-w-[100px]">
                   <p className="text-xs text-gray-300 uppercase tracking-wider font-bold">Stage</p>
                   <p className={`text-3xl font-bold leading-none mt-2 ${stage === 'up' ? 'text-blue-400' : 'text-green-400'}`}>
                       {stage ? stage.toUpperCase() : '-'}
                   </p>
               </div>
          </div>

          {/* Coach Cue Overlay - Center */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
             <div key={coachCue} className="animate-fade-in-out text-center">
                 <h1 className="text-6xl md:text-8xl font-black text-white/90 drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] tracking-tight stroke-text">
                     {coachCue}
                 </h1>
             </div>
          </div>

          {/* Angle Indicators - Floating Bubbles */}
          <div className="absolute bottom-6 left-6 z-10 space-y-3">
              <div className="bg-black/50 backdrop-blur-sm p-4 rounded-xl border border-white/10 w-48">
                  <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-400">Left {exercise === 'squat' ? 'Knee' : 'Elbow'}</span>
                      <span className="text-xl font-bold text-white">{exercise === 'squat' ? leftKneeAngle : leftAngle}°</span>
                  </div>
                  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 transition-all duration-300"
                        style={{ width: `${Math.min(((exercise === 'squat' ? leftKneeAngle : leftAngle) / 180) * 100, 100)}%` }}
                      />
                  </div>
              </div>
              <div className="bg-black/50 backdrop-blur-sm p-4 rounded-xl border border-white/10 w-48">
                  <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-400">Right {exercise === 'squat' ? 'Knee' : 'Elbow'}</span>
                      <span className="text-xl font-bold text-white">{exercise === 'squat' ? rightKneeAngle : rightAngle}°</span>
                  </div>
                  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 transition-all duration-300"
                        style={{ width: `${Math.min(((exercise === 'squat' ? rightKneeAngle : rightAngle) / 180) * 100, 100)}%` }}
                      />
                  </div>
              </div>
          </div>

          {/* Calibration Panel */}
          {calibrating && (
             <div className="absolute bottom-6 right-6 z-20 bg-gray-900/95 backdrop-blur-md p-6 rounded-xl border border-gray-700 w-80 text-sm text-gray-300">
                 <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                    <Settings className="w-4 h-4" /> Calibration
                 </h3>
                 <p className="mb-4 text-xs">Adjust thresholds for your camera angle.</p>

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
    </div>
  );
};

export default WorkoutSession;
