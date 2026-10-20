import React,{createContext,useContext} from 'react';
export const ThemeContext=createContext({dark:false,toggle:()=>{}});
export const ProBrandContext=createContext(false);
export const BrandLogo:React.FC<(React.ImgHTMLAttributes<HTMLImageElement>&{hideProBadge?:boolean})>=props=>{
 const {dark}=useContext(ThemeContext);
 const {hideProBadge,...imageProps}=props;
 const pro=useContext(ProBrandContext)&&!hideProBadge;
 const logo=<img {...imageProps} src={dark?'./assets/logo-dark.svg':'./assets/logo.svg'}/>;
 return pro?<span className="pro-brand">{logo}<span className="brand-pro-badge" aria-label="مشترك Pro">PRO</span></span>:logo;
};
export const ThemeToggle:React.FC=()=>{
 const {dark,toggle}=useContext(ThemeContext);
 return <div className="toggle-row theme-toggle"><span>الوضع الداكن</span><button type="button" role="switch" aria-label="الوضع الداكن" aria-checked={dark} className={`toggle-btn ${dark?'is-on':''}`} onClick={toggle}>{dark?'مفعّل':'مغلق'}</button></div>;
};
