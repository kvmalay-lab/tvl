import React, { useRef, useEffect, useState } from 'react';
import Webcam from 'react-webcam';
import { Pose, POSE_CONNECTIONS } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';

function App() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [pose, setPose] = useState(null);
  const [reps, setReps] = useState(0);
  const [leftAngle, setLeftAngle] = useState(0);
  const [rightAngle, setRightAngle] = useState(0);
  const [leftKneeAngle, setLeftKneeAngle] = useState(0);
  const [rightKneeAngle, setRightKneeAngle] = useState(0);
  const [exercise, setExercise] = useState('bicep');
  const [autoDetectEnabled, setAutoDetectEnabled] = useState(true);
  const [suggestedExercise, setSuggestedExercise] = useState(null);
  const [suggestionConfidence, setSuggestionConfidence] = useState(0);
  const [useSampleVideo, setUseSampleVideo] = useState(false);
  const [sampleUrl, setSampleUrl] = useState(null);
  const sampleVideoRef = useRef(null);
  // calibration / thresholds
  const [thresholds, setThresholds] = useState(() => {
    try {
      const raw = localStorage.getItem('tvl_thresholds');
      return raw ? JSON.parse(raw) : { elbowUp: 30, elbowDown: 160, kneeSquat: 100, kneeStand: 160, suggestConf: 0.4 };
    } catch (e) { return { elbowUp: 30, elbowDown: 160, kneeSquat: 100, kneeStand: 160, suggestConf: 0.4 }; }
  });
  const thresholdsRef = useRef(thresholds);
  useEffect(()=>{ thresholdsRef.current = thresholds; localStorage.setItem('tvl_thresholds', JSON.stringify(thresholds)); }, [thresholds]);
  const latestAnglesRef = useRef({ leftElbow:0, rightElbow:0, leftKnee:0, rightKnee:0 });
  const [calibrating, setCalibrating] = useState(false);
  const [stage, setStage] = useState(null);
  const [webcamReady, setWebcamReady] = useState(false);
  const repsRef = useRef(0);
  const stageRef = useRef(null);
  const exerciseRef = useRef(exercise);
  const detectExerciseRepsRef = useRef(null);
  // smoothing buffers for angles to reduce jitter
  const angleBuffersRef = useRef({});

  // Calculate angle between three points (from your notebook)
  const calculateAngle = (a, b, c) => {
    const aArr = [a.x, a.y];
    const bArr = [b.x, b.y];
    const cArr = [c.x, c.y];
    
    const radians = Math.atan2(cArr[1] - bArr[1], cArr[0] - bArr[0]) - 
                   Math.atan2(aArr[1] - bArr[1], aArr[0] - bArr[0]);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    
    if (angle > 180.0) {
      angle = 360 - angle;
    }
    
    return Math.round(angle);
  };

  const smoothAngle = (key, value, windowSize = 5) => {
    if (!angleBuffersRef.current[key]) angleBuffersRef.current[key] = [];
    const buf = angleBuffersRef.current[key];
    buf.push(value);
    if (buf.length > windowSize) buf.shift();
    const sum = buf.reduce((s, v) => s + v, 0);
    return Math.round(sum / buf.length);
  };

  // Human-friendly exercise information and target angles
  const exerciseInfo = {
    bicep: {
      title: 'Bicep Curl — Angle Guidance',
      bullets: [
        'Peak Activation Angle: Elbow flexion of 55° to 60%.',
        'Maximum Resistance Angle: At 90° (forearm horizontal), where gravity exerts the most torque on the elbow joint.',
        'Optimal Bench Angle (Incline): 45°–60° to target the long head while limiting shoulder involvement.'
      ]
    },
    squat: {
      title: 'Squat — Angle Guidance',
      bullets: [
        'Peak Activation Angle: 90° of knee flexion (thighs parallel) — highest quadriceps & glute recruitment.',
        'Optimal 2025 Research: 90° is superior for isometric activation with reduced joint strain.',
        'Deep Squat Variation: >110°–140° typically reduces quadriceps activation as contractile efficiency drops.'
      ]
    },
    pushup: {
      title: 'Push-up — Angle Guidance',
      bullets: [
        'Body Angle: Maximum pectoralis activation at 0° (body parallel) or slight decline (~-15°).',
        'Elbow Tuck Angle: ~45° relative to the torso optimizes chest activation and shoulder safety.',
        'Shoulder Safety: Elbow flare >60° increases shoulder impingement risk.'
      ]
    },
    latpulldown: {
      title: 'Lat Pulldown — Angle Guidance',
      bullets: [
        'Torso Lean Angle: Slight backward lean of 20°–30° aligns the lats with the cable line of pull.',
        'Shoulder Joint Angle: Peak activation in mid-range; bar around mid-chest at the end of the pull.'
      ]
    }
  };

  // Detect rep using proven thresholds (160° down, 30° up)
  const detectRep = (angle) => {
    // Stage: Down - arm extended
    if (angle > 160) {
      stageRef.current = 'down';
      setStage('down');
    }
    
    // Stage: Up - arm curled, and previously was down
    if (angle < 30 && stageRef.current === 'down') {
      stageRef.current = 'up';
      setStage('up');
      repsRef.current += 1;
      setReps(repsRef.current);
      console.log('Rep counted! Total:', repsRef.current);
    }
  };

  // Detect reps for different exercises
  const detectExerciseReps = (mode, angles) => {
    // helper to increment rep and set stage
    const countRep = () => {
      repsRef.current += 1;
      setReps(repsRef.current);
      console.log(`${mode} rep counted! Total:`, repsRef.current);
    };

    const t = thresholdsRef.current;
    switch (mode) {
      case 'bicep': {
        const angle = angles.leftElbow || angles.rightElbow || 0;
        if (!angle) return;
        // use calibrated thresholds
        if (angle > t.elbowDown) {
          stageRef.current = 'down'; setStage('down');
        }
        if (angle < t.elbowUp && stageRef.current === 'down') {
          stageRef.current = 'up'; setStage('up'); repsRef.current += 1; setReps(repsRef.current);
        }
        break;
      }

      case 'squat': {
        const kneeAvg = ((angles.leftKnee || 0) + (angles.rightKnee || 0)) / 2;
        if (kneeAvg === 0) return;
        if (kneeAvg > t.kneeStand) {
          if (stageRef.current === 'down') countRep();
          stageRef.current = 'up'; setStage('up');
        } else if (kneeAvg < t.kneeSquat) {
          stageRef.current = 'down'; setStage('down');
        }
        break;
      }

      case 'pushup': {
        const elAvg = ((angles.leftElbow || 0) + (angles.rightElbow || 0)) / 2;
        if (elAvg === 0) return;
        // Up: ~160+, Down: < 90
        if (elAvg > 160) {
          if (stageRef.current === 'down') {
            countRep();
          }
          stageRef.current = 'up';
          setStage('up');
        } else if (elAvg < 90) {
          stageRef.current = 'down';
          setStage('down');
        }
        break;
      }

      case 'latpulldown': {
        const angle = angles.leftElbow || angles.rightElbow || 0;
        if (!angle) return;
        // Up (arms overhead) ~160+, Pulled down < 80
        if (angle > 150) {
          if (stageRef.current === 'down') {
            countRep();
          }
          stageRef.current = 'up';
          setStage('up');
        } else if (angle < 80) {
          stageRef.current = 'down';
          setStage('down');
        }
        break;
      }

      default:
        break;
    }
  };

  // keep detectExerciseReps in a ref so the MediaPipe callback (created once)
  // can call the latest implementation and read the current exercise
  useEffect(() => {
    detectExerciseRepsRef.current = detectExerciseReps;
  }, [detectExerciseReps]);

  // keep exercise selection in a ref so mediaPipe onResults reads current choice
  useEffect(() => {
    exerciseRef.current = exercise;
    // reset stage and reps when switching exercises
    stageRef.current = null;
    setStage(null);
    repsRef.current = 0;
    setReps(0);
  }, [exercise]);

  // 1. Initialize MediaPipe Pose
  useEffect(() => {
    let mediaPipePose = null;

    const initPose = async () => {
      mediaPipePose = new Pose({
        // Use jsDelivr without a hardcoded patch version so the runtime files resolve
        // to the installed package version; avoids mismatches with package.json.
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
      });

      // Increase model complexity and confidence thresholds for better accuracy
      mediaPipePose.setOptions({
        modelComplexity: 2,
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: true,
        minDetectionConfidence: 0.65,
        minTrackingConfidence: 0.65,
        // Disable selfieMode so landmarks are reported in non-mirrored coordinates
        selfieMode: false,
      });

      mediaPipePose.onResults((results) => {
        // Diagnostic logging to help determine why detection may be failing
        console.debug('MediaPipe onResults called, landmarks:', results.poseLandmarks?.length ?? 0);

        // Only proceed if landmarks are present
        const landmarks = results.poseLandmarks;
        if (landmarks && landmarks.length > 0) {
          // require visibility for key landmarks to improve reliability
          const vis = (i) => (landmarks[i] && typeof landmarks[i].visibility === 'number') ? landmarks[i].visibility : 1;

          // Compute elbow angles (shoulder-elbow-wrist)
          let smoothL = null;
          let smoothR = null;
          let smoothLK = null;
          let smoothRK = null;

          // visibility thresholds (knees often need higher visibility)
          const elbowVisThresh = 0.5;
          const kneeVisThresh = 0.6;

          if (vis(11) > elbowVisThresh && vis(13) > elbowVisThresh && vis(15) > elbowVisThresh) {
            const lElbow = calculateAngle(landmarks[11], landmarks[13], landmarks[15]);
            smoothL = smoothAngle('leftElbow', lElbow, 5);
            setLeftAngle(smoothL);
          }
          if (vis(12) > elbowVisThresh && vis(14) > elbowVisThresh && vis(16) > elbowVisThresh) {
            const rElbow = calculateAngle(landmarks[12], landmarks[14], landmarks[16]);
            smoothR = smoothAngle('rightElbow', rElbow, 5);
            setRightAngle(smoothR);
          }

          // Compute knee angles (hip-knee-ankle) with stronger smoothing
          if (vis(23) > kneeVisThresh && vis(25) > kneeVisThresh && vis(27) > kneeVisThresh) {
            const lKnee = calculateAngle(landmarks[23], landmarks[25], landmarks[27]);
            smoothLK = smoothAngle('leftKnee', lKnee, 7);
            setLeftKneeAngle(smoothLK);
          }
          if (vis(24) > kneeVisThresh && vis(26) > kneeVisThresh && vis(28) > kneeVisThresh) {
            const rKnee = calculateAngle(landmarks[24], landmarks[26], landmarks[28]);
            smoothRK = smoothAngle('rightKnee', rKnee, 7);
            setRightKneeAngle(smoothRK);
          }

          // optional auto-detect suggestion
          if (autoDetectEnabled) {
            const suggestedObj = autoDetectExercise({
              leftElbow: smoothL ?? leftAngle,
              rightElbow: smoothR ?? rightAngle,
              leftKnee: smoothLK ?? leftKneeAngle,
              rightKnee: smoothRK ?? rightKneeAngle,
            }, landmarks);
            // only suggest if confidence reasonably high
            if (suggestedObj && suggestedObj.score > 0.4 && suggestedObj.name !== exerciseRef.current) {
              // suggestion stored in state by autoDetectExercise; no auto-switch
            }
          }

          // Dispatch to exercise-specific detector using the freshest refs
          // update latest angles ref for calibration
          latestAnglesRef.current = {
            leftElbow: smoothL ?? leftAngle,
            rightElbow: smoothR ?? rightAngle,
            leftKnee: smoothLK ?? leftKneeAngle,
            rightKnee: smoothRK ?? rightKneeAngle,
          };

          if (detectExerciseRepsRef.current) {
            detectExerciseRepsRef.current(exerciseRef.current, {
              leftElbow: latestAnglesRef.current.leftElbow,
              rightElbow: latestAnglesRef.current.rightElbow,
              leftKnee: latestAnglesRef.current.leftKnee,
              rightKnee: latestAnglesRef.current.rightKnee,
              landmarks,
            });
          }
        }
        drawCanvas(results);
      });

      setPose(mediaPipePose);
      console.log('MediaPipe Pose initialized');
    };

    initPose();

    return () => {
      try {
        if (mediaPipePose && typeof mediaPipePose.close === 'function') {
          mediaPipePose.close();
        }
      } catch (e) {
        // ignore cleanup errors
      }
    };
  }, []);

  // helper to produce exercise-specific guidance message
  const getStageMessage = (exerciseKey, stageVal) => {
    if (exerciseKey === 'bicep') {
      return stageVal === 'down' ? '📖 ARM DOWN - Ready to curl up' : stageVal === 'up' ? '💪 ARM UP - Complete the rep!' : '✋ Position your arms to start';
    }
    if (exerciseKey === 'squat') {
      return stageVal === 'down' ? '🔽 KNEES BENT - Hold the squat' : stageVal === 'up' ? '⬆️ Standing - rep counted' : '👣 Stand with feet shoulder-width apart';
    }
    if (exerciseKey === 'pushup') {
      return stageVal === 'down' ? '👇 CHEST LOW - Keep core tight' : stageVal === 'up' ? '⬆️ BODY STRAIGHT - rep counted' : '🤸 Get into high plank position';
    }
    if (exerciseKey === 'latpulldown') {
      return stageVal === 'down' ? '⬇️ PULL - Squeeze shoulder blades' : stageVal === 'up' ? '⬆️ RELEASE - rep counted' : '🪢 Sit upright and grip bar';
    }
    return 'Get into position';
  };

  // 2. Handle webcam ready
  const handleUserMedia = () => {
    console.log('Webcam is ready');
    setWebcamReady(true);
  };

  // 3. Continuous detection loop
  useEffect(() => {
    let animationFrameId;

    const detect = async () => {
      const sourceVideo = useSampleVideo ? sampleVideoRef.current : webcamRef.current?.video;
      const ready = sourceVideo && sourceVideo.readyState === 4;
      if (pose && (webcamReady || useSampleVideo) && ready) {
        try {
          await pose.send({ image: sourceVideo });
        } catch (error) {
          console.error('Error during pose detection:', error);
        }
      }
      animationFrameId = requestAnimationFrame(detect);
    };

    if (pose && webcamReady) {
      detect();
    }

    return () => cancelAnimationFrame(animationFrameId);
  }, [pose, webcamReady]);

  // Auto-detection logic (rule-based)
  const autoDetectExercise = (angles, landmarks) => {
    if (!landmarks) return;
    // compute averages where available
    const hasLeftEl = typeof angles.leftElbow === 'number' && angles.leftElbow > 0;
    const hasRightEl = typeof angles.rightElbow === 'number' && angles.rightElbow > 0;
    const hasLeftK = typeof angles.leftKnee === 'number' && angles.leftKnee > 0;
    const hasRightK = typeof angles.rightKnee === 'number' && angles.rightKnee > 0;

    const elbowVals = [];
    if (hasLeftEl) elbowVals.push(angles.leftElbow);
    if (hasRightEl) elbowVals.push(angles.rightElbow);
    const elbowAvg = elbowVals.length ? elbowVals.reduce((s,v)=>s+v,0)/elbowVals.length : null;

    const kneeVals = [];
    if (hasLeftK) kneeVals.push(angles.leftKnee);
    if (hasRightK) kneeVals.push(angles.rightKnee);
    const kneeAvg = kneeVals.length ? kneeVals.reduce((s,v)=>s+v,0)/kneeVals.length : null;

    // torso tilt approx: angle between shoulder midpoint and hip midpoint
    const sMidX = (landmarks[11].x + landmarks[12].x) / 2;
    const sMidY = (landmarks[11].y + landmarks[12].y) / 2;
    const hMidX = (landmarks[23].x + landmarks[24].x) / 2;
    const hMidY = (landmarks[23].y + landmarks[24].y) / 2;
    const dx = sMidX - hMidX;
    const dy = sMidY - hMidY;
    const torsoTilt = Math.abs(Math.atan2(dy, dx)) * 180 / Math.PI; // degrees

    // scoring
    const scores = { bicep: 0, squat: 0, pushup: 0, latpulldown: 0 };

    if (kneeAvg !== null) {
      // low knee angle => squat
      if (kneeAvg < 120) scores.squat += 0.9; // strong indicator
      else if (kneeAvg < 140) scores.squat += 0.4;
      else scores.squat += 0.1;
    }

    if (elbowAvg !== null) {
      // small elbow angle -> curls or pushup (depending on torso tilt)
      if (elbowAvg < 100) {
        // if torso is fairly horizontal -> pushup
        if (torsoTilt < 45) scores.pushup += 0.9;
        else scores.bicep += 0.9;
      } else if (elbowAvg < 140) {
        scores.bicep += 0.3;
      } else {
        // extended elbows could be start/end of lat pulldown
        scores.latpulldown += 0.2;
      }
    }

    // torso upright favors bicep/squat/lat; torso horizontal favors pushup
    if (torsoTilt < 40) scores.pushup += 0.3; else scores.bicep += 0.1;

    // prefer right-side signals slightly for dominant side
    if (hasRightEl && angles.rightElbow < 100) scores.bicep += 0.05;
    if (hasRightK && angles.rightKnee < 120) scores.squat += 0.05;

    // pick best
    const best = Object.entries(scores).sort((a,b)=>b[1]-a[1])[0];
    const [bestName, bestScore] = best;
    setSuggestedExercise(bestName);
    setSuggestionConfidence(bestScore);
    return { name: bestName, score: bestScore };
  };

  // 4. Drawing function
  const drawCanvas = (results) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get canvas dimensions from active source (webcam or sample video)
    const sourceVideo = useSampleVideo ? sampleVideoRef.current : webcamRef.current?.video;
    if (!sourceVideo) return;

    // Set canvas size to match video
    canvas.width = sourceVideo.videoWidth || 640;
    canvas.height = sourceVideo.videoHeight || 480;
    // Draw video frame without flipping (MediaPipe handles coordinates)
    ctx.drawImage(sourceVideo, 0, 0, canvas.width, canvas.height);

    // Draw pose landmarks and connections
    if (results.poseLandmarks && results.poseLandmarks.length > 0) {
      const landmarks = results.poseLandmarks;

      // Draw connections
      POSE_CONNECTIONS.forEach(([start, end]) => {
        const from = landmarks[start];
        const to = landmarks[end];

        if (from && to) {
          ctx.beginPath();
          ctx.moveTo(from.x * canvas.width, from.y * canvas.height);
          ctx.lineTo(to.x * canvas.width, to.y * canvas.height);
          ctx.strokeStyle = '#00FF00';
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      });

      // Draw landmarks
      landmarks.forEach((landmark) => {
        if (landmark) {
          ctx.beginPath();
          ctx.arc(landmark.x * canvas.width, landmark.y * canvas.height, 6, 0, 2 * Math.PI);
          ctx.fillStyle = '#FF00FF';
          ctx.fill();
          ctx.strokeStyle = '#00FF00';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });
      // Small detection badge
      ctx.fillStyle = 'rgba(0,255,0,0.85)';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Pose detected', 10, 20);
    } else {
      // No landmarks — show message to help debugging
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No pose detected — ensure camera is visible', canvas.width / 2, canvas.height / 2);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
      <h1 className="text-4xl font-bold mb-2">TVL Fitness Tracker</h1>
      <h2 className="text-xl text-indigo-400 mb-3">{exercise === 'bicep' ? 'Bicep Curl' : exercise === 'squat' ? 'Squat' : exercise === 'pushup' ? 'Push-up' : exercise === 'latpulldown' ? 'Lat Pulldown' : ''} Rep Counter</h2>
      <div className="mb-6 flex gap-3">
        <button onClick={() => { setExercise('bicep'); repsRef.current = 0; setReps(0); }} className={`px-3 py-1 rounded ${exercise === 'bicep' ? 'bg-indigo-500' : 'bg-gray-700'}`}>Bicep</button>
        <button onClick={() => { setExercise('squat'); repsRef.current = 0; setReps(0); }} className={`px-3 py-1 rounded ${exercise === 'squat' ? 'bg-indigo-500' : 'bg-gray-700'}`}>Squat</button>
        <button onClick={() => { setExercise('pushup'); repsRef.current = 0; setReps(0); }} className={`px-3 py-1 rounded ${exercise === 'pushup' ? 'bg-indigo-500' : 'bg-gray-700'}`}>Push-up</button>
        <button onClick={() => { setExercise('latpulldown'); repsRef.current = 0; setReps(0); }} className={`px-3 py-1 rounded ${exercise === 'latpulldown' ? 'bg-indigo-500' : 'bg-gray-700'}`}>Lat Pulldown</button>
        <div className="ml-4 flex items-center gap-3">
          <label className="text-sm">Auto-detect</label>
          <input type="checkbox" checked={autoDetectEnabled} onChange={(e)=>setAutoDetectEnabled(e.target.checked)} />
          <label className="ml-3 text-sm">Use sample video</label>
          <input type="file" accept="video/*" onChange={(e)=>{
            const f = e.target.files && e.target.files[0];
            if (!f) return;
            const url = URL.createObjectURL(f);
            setSampleUrl(url);
            setUseSampleVideo(true);
            // autoplay when ready
            setTimeout(()=>{ try{ sampleVideoRef.current && sampleVideoRef.current.play(); setWebcamReady(true);}catch(e){} }, 300);
          }} />
          <button onClick={()=>{
            // try to load workspace sample path (may or may not be served)
            const wsPath = '/src/videos/exercise_samples.mp4';
            setSampleUrl(wsPath);
            setUseSampleVideo(true);
            setTimeout(()=>{ try{ sampleVideoRef.current && sampleVideoRef.current.play(); setWebcamReady(true);}catch(e){} }, 300);
          }} className="px-2 py-1 rounded bg-gray-700 ml-2 text-sm">Load workspace sample</button>
        </div>
      </div>

      {/* suggestion banner */}
      {autoDetectEnabled && suggestedExercise && suggestedExercise !== exercise && suggestionConfidence > 0.4 && (
        <div className="mb-4 p-3 bg-yellow-500 rounded flex items-center justify-between max-w-2xl">
          <div>
            <strong>Suggested:</strong> {suggestedExercise} &nbsp; ({Math.round(suggestionConfidence*100)}% confidence)
          </div>
          <div className="flex gap-2">
            <button onClick={()=>{ setExercise(suggestedExercise); repsRef.current=0; setReps(0); setStage(null); setUseSampleVideo(false); }} className="px-3 py-1 bg-green-700 rounded">Accept</button>
            <button onClick={()=>{ setSuggestedExercise(null); }} className="px-3 py-1 bg-gray-800 rounded">Dismiss</button>
          </div>
        </div>
      )}

      {/* Calibration UI */}
      <div className="mb-4 flex gap-3 items-center">
        <button onClick={()=>setCalibrating(s=>!s)} className="px-3 py-1 bg-indigo-600 rounded">{calibrating? 'Close Calibration':'Calibrate'}</button>
        <div className="text-sm text-gray-300">Thresholds: Elbow Up {thresholds.elbowUp}°, Elbow Down {thresholds.elbowDown}°, Knee Squat {thresholds.kneeSquat}°</div>
      </div>

      {calibrating && (
        <div className="mb-6 p-4 bg-gray-800 rounded border">
          <p className="mb-2">Calibration (suggest-only): Position yourself for the <strong>start</strong> pose (e.g., standing/arm down) and press <strong>Capture Start Pose</strong>. Then perform the <strong>end</strong> pose (e.g., curled up / squat) and press <strong>Capture End Pose</strong>. The app will set thresholds based on captured angles.</p>
          <div className="flex gap-3">
            <button onClick={()=>{
              const a = latestAnglesRef.current;
              // for bicep start pose -> elbow down
              const down = Math.min(a.leftElbow || 999, a.rightElbow || 999);
              if (down && down < 999) setThresholds(s=>({ ...s, elbowDown: Math.round(down) }));
            }} className="px-3 py-1 bg-gray-700 rounded">Capture Start Pose</button>
            <button onClick={()=>{
              const a = latestAnglesRef.current;
              // end pose -> elbow up
              const up = Math.max(a.leftElbow || 0, a.rightElbow || 0);
              if (up) setThresholds(s=>({ ...s, elbowUp: Math.max(10, Math.round(up)) }));
            }} className="px-3 py-1 bg-gray-700 rounded">Capture End Pose</button>
            <button onClick={()=>{
              const a = latestAnglesRef.current;
              const downK = Math.min(a.leftKnee || 999, a.rightKnee || 999);
              if (downK && downK < 999) setThresholds(s=>({ ...s, kneeSquat: Math.round(downK) }));
            }} className="px-3 py-1 bg-gray-700 rounded">Capture Squat Pose</button>
            <button onClick={()=>{
              const a = latestAnglesRef.current;
              const standK = Math.max(a.leftKnee || 0, a.rightKnee || 0);
              if (standK) setThresholds(s=>({ ...s, kneeStand: Math.round(standK) }));
            }} className="px-3 py-1 bg-gray-700 rounded">Capture Stand Pose</button>
            <button onClick={()=>{ localStorage.removeItem('tvl_thresholds'); setThresholds({ elbowUp:30, elbowDown:160, kneeSquat:100, kneeStand:160, suggestConf:0.4 }); }} className="px-3 py-1 bg-red-700 rounded">Reset</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6 mb-6 w-full max-w-2xl">
        <div className="bg-gray-800 p-4 rounded-lg border-2 border-indigo-500 text-center">
          <p className="text-gray-400 text-sm">Webcam Status</p>
          <p className="text-2xl font-bold text-indigo-400">
            {webcamReady ? '✓ Active' : '⏳ Starting...'}
          </p>
        </div>

        <div className="bg-gradient-to-br from-green-600 to-green-400 p-4 rounded-lg border-2 border-green-500 text-center shadow-lg">
          <p className="text-gray-900 text-sm font-bold">TOTAL REPS</p>
          <p className="text-5xl font-bold text-white">{reps}</p>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg border-2 border-yellow-500 text-center">
          <p className="text-gray-400 text-sm">Stage</p>
          <p className={`text-2xl font-bold ${stage === 'up' ? 'text-red-400' : stage === 'down' ? 'text-green-400' : 'text-gray-400'}`}>
            {stage ? stage.toUpperCase() : 'READY'}
          </p>
        </div>
      </div>

      <div className="relative w-[960px] h-[720px] border-4 border-indigo-500 rounded-lg overflow-hidden mb-6 shadow-xl bg-black">
        <Webcam
          ref={webcamRef}
          className="absolute top-0 left-0 w-full h-full object-cover"
          onUserMedia={handleUserMedia}
          mirrored={false}
          videoConstraints={{
            width: 960,
            height: 720,
            facingMode: 'user'
          }}
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full"
        />
        {/* sample video element (hidden) used for tuning/detection from a file */}
        <video ref={sampleVideoRef} src={sampleUrl || undefined} style={{ display: 'none' }} crossOrigin="anonymous" muted playsInline />
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Left measurement panel - dynamic label/value based on exercise */}
        <div className="bg-gray-800 p-6 rounded-lg border-2 border-blue-500 w-64">
          <p className="text-gray-400 text-sm mb-2">{exercise === 'squat' ? 'LEFT KNEE ANGLE' : 'LEFT ARM ANGLE'}</p>
          <p className={`text-4xl font-bold ${(() => {
            const val = exercise === 'squat' ? leftKneeAngle : leftAngle;
            if (exercise === 'squat') return val > 160 ? 'text-green-400' : val < 100 ? 'text-red-400' : 'text-blue-400';
            return val > 160 ? 'text-green-400' : val < 30 ? 'text-red-400' : 'text-blue-400';
          })()}`}>
            {exercise === 'squat' ? leftKneeAngle : leftAngle}
          </p>
          <p className="text-xs text-gray-500 mt-2">{exercise === 'squat' ? 'Stand:160+ | Squat:<100' : 'Down:160+ deg | Up:30- deg'}</p>
        </div>

        {/* Right measurement panel - dynamic label/value based on exercise */}
        <div className="bg-gray-800 p-6 rounded-lg border-2 border-purple-500 w-64">
          <p className="text-gray-400 text-sm mb-2">{exercise === 'squat' ? 'RIGHT KNEE ANGLE' : 'RIGHT ARM ANGLE'}</p>
          <p className={`text-4xl font-bold ${(() => {
            const val = exercise === 'squat' ? rightKneeAngle : rightAngle;
            if (exercise === 'squat') return val > 160 ? 'text-green-400' : val < 100 ? 'text-red-400' : 'text-purple-400';
            return val > 160 ? 'text-green-400' : val < 30 ? 'text-red-400' : 'text-purple-400';
          })()}`}>
            {exercise === 'squat' ? rightKneeAngle : rightAngle}
          </p>
          <p className="text-xs text-gray-500 mt-2">{exercise === 'squat' ? 'Stand:160+ | Squat:<100' : 'Down:160+ deg | Up:30- deg'}</p>
        </div>
      </div>

      <div className="bg-gray-800 p-4 rounded-lg border border-gray-600 text-center max-w-md">
        <p className="text-gray-300 text-sm">
          {getStageMessage(exercise, stage)}
        </p>
      </div>

      <div className="mt-6 bg-gray-800 p-6 rounded-lg border border-gray-700 max-w-3xl">
        <h3 className="text-lg font-bold text-indigo-300 mb-3">{exerciseInfo[exercise].title}</h3>
        <ul className="list-disc list-inside text-sm text-gray-300 space-y-2">
          {exerciseInfo[exercise].bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default App;
