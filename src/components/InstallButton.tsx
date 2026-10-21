import {BrandLogo} from './Theme';
import React,{useEffect,useState} from 'react';
import {getInstallPrompt,promptInstall,subscribeInstall} from '../services/pwa';
function standalone(){return window.matchMedia('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone===true;}
export const InstallButton:React.FC=()=>{
 const [installed,setInstalled]=useState(standalone);
 const [help,setHelp]=useState(false);
 const [,update]=useState(0);
 useEffect(()=>subscribeInstall(()=>{setInstalled(standalone());update(n=>n+1);}),[]);
 if(installed)return null;
 const install=async()=>{
  if(getInstallPrompt()){
   try{if(await promptInstall())setInstalled(true);}catch{setHelp(true);}
  }else setHelp(!help);
 };
 const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 return <div className="install-app"><button type="button" className="btn-menu btn-menu--warm install-app-button" onClick={install}><BrandLogo interactive={false} alt="" hideProBadge/>تحميل صادوه</button>{help&&<p className="install-app-help" role="status">{ios?'افتح اللعبة في Safari، ثم اضغط «مشاركة» واختر «إضافة إلى الشاشة الرئيسية».':'من قائمة المتصفح اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية». إذا كنت داخل تطبيق، افتح الرابط في Chrome أو Edge.'}</p>}</div>;
};
