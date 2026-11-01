import React,{createContext,useContext,useEffect,useState} from 'react';
import {loadUserSettings,saveUserSettings} from '../services/storage/localSettings';
import {setLanguage,type Language} from './translate';
const Context=createContext<{language:Language;change:(language:Language)=>void}>({language:'ar',change:()=>{}});
export function LanguageProvider({children}:{children:React.ReactNode}){
 const [language,update]=useState<Language>(()=>loadUserSettings().language);
 setLanguage(language);
 useEffect(()=>{document.documentElement.lang=language;document.documentElement.dir=language==='ar'?'rtl':'ltr';document.title=language==='ar'?'صادوه! — لعبة البطاقات السعودية':'Sadooh! — Saudi Card Game';},[language]);
 useEffect(()=>{const refresh=()=>update(loadUserSettings().language);window.addEventListener('sadooh-settings',refresh);window.addEventListener('storage',refresh);return()=>{window.removeEventListener('sadooh-settings',refresh);window.removeEventListener('storage',refresh);};},[]);
 return <Context.Provider value={{language,change:language=>{saveUserSettings({language});update(language);}}}>{children}</Context.Provider>;
}
export const useLanguage=()=>useContext(Context);
export function LanguageToggle(){const {language,change}=useLanguage();return <button className="language-toggle btn-secondary btn-sm" type="button" aria-label={language==='ar'?'Switch to English':'التبديل إلى العربية'} onClick={()=>change(language==='ar'?'en':'ar')} lang={language==='ar'?'en':'ar'}>{language==='ar'?'English':'عربي'}</button>;}
