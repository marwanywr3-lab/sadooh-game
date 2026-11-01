import {t,fmt,tr} from '../i18n/translate';
import {SoundControls} from './Feedback';
import React,{createContext,useContext} from 'react';
export const ThemeContext=createContext({dark:false,toggle:()=>{}});
export const ProBrandContext=createContext(false);
export const BrandNavigationContext=createContext<{onHome?:()=>void;onPro?:()=>void}>({});
export const BrandLogo:React.FC<(React.ImgHTMLAttributes<HTMLImageElement>&{hideProBadge?:boolean;interactive?:boolean;onHome?:()=>void})>=props=>{
 const {dark}=useContext(ThemeContext);
 const navigation=useContext(BrandNavigationContext);
 const {hideProBadge,interactive=true,onHome,...imageProps}=props;
 const pro=useContext(ProBrandContext)&&!hideProBadge;
 const logo=<img {...imageProps} src={dark?'./assets/logo-dark.svg':'./assets/logo.svg'}/>;
 const home=onHome||navigation.onHome;
 const image=interactive&&home?<button type="button" className="brand-home" aria-label={t("العودة للقائمة الرئيسية")} onClick={home}>{tr(logo)}</button>:logo;
 const badge=interactive&&navigation.onPro?<button type="button" className="brand-pro-badge brand-pro-link" aria-label={t("تخصيص Pro")} onClick={navigation.onPro}>PRO</button>:<span className="brand-pro-badge" aria-label={t("مشترك Pro")}>PRO</span>;
 return pro?<span className="pro-brand">{tr(image)}{tr(badge)}</span>:image;
};
export const ThemeToggle:React.FC<{audio?:boolean}>=({audio=true})=>{
 const {dark,toggle}=useContext(ThemeContext);
 return <><div className="toggle-row theme-toggle"><span>{""+t("الوضع الداكن")+""}</span><button type="button" role="switch" aria-label={t("الوضع الداكن")} aria-checked={dark} className={`toggle-btn ${dark?'is-on':''}`} onClick={toggle}>{tr(dark?t("مفعّل"):t("مغلق"))}</button></div>{tr(audio&&<details className="feedback-audio-settings"><summary>{""+t("الصوت")+""}</summary><SoundControls/></details>)}</>;
};
