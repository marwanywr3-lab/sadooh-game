import React,{createContext,useContext} from 'react';
export const ThemeContext=createContext({dark:false,toggle:()=>{}});
export const BrandLogo:React.FC<React.ImgHTMLAttributes<HTMLImageElement>>=props=>{
 const {dark}=useContext(ThemeContext);
 return <img {...props} src={dark?'./assets/logo-dark.svg':'./assets/logo.svg'}/>;
};
export const ThemeToggle:React.FC=()=>{
 const {dark,toggle}=useContext(ThemeContext);
 return <div className="toggle-row theme-toggle"><span>الوضع الداكن</span><button type="button" role="switch" aria-label="الوضع الداكن" aria-checked={dark} className={`toggle-btn ${dark?'is-on':''}`} onClick={toggle}>{dark?'مفعّل':'مغلق'}</button></div>;
};
