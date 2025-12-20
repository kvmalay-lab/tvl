import React from 'react';
export default function App(){
  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0f172a',color:'#fff'}}>
      <div style={{textAlign:'center'}}>
        <h1 style={{fontSize:32,marginBottom:8}}>TVL Fitness Tracker — Debug</h1>
        <p style={{opacity:0.9}}>If you see this, the app bundle loaded successfully. The white screen indicates a runtime error in the main `App.jsx` code.</p>
        <p style={{marginTop:12}}><strong>Next steps:</strong> I can restore the original app and patch the specific runtime issue once we identify it.</p>
      </div>
    </div>
  );
}
