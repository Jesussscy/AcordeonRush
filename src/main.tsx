import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import PracticeStudio from './Workspace';
import './styles.css';

function Root(){
 const [legacy,setLegacy]=React.useState(false);
 return legacy?<><button className="return-to-practice" onClick={()=>{location.hash='practice';setLegacy(false);}}>↔ Abrir práctica 3D</button><App/></>:<PracticeStudio onLegacy={()=>{location.hash='studio';setLegacy(true);}}/>;
}
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><Root/></React.StrictMode>);
