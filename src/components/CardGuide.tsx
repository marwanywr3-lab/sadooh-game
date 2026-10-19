import React from 'react';
import {CHARACTER_LIST} from '../game/rules/characters';
const simple:Record<string,string>={malqoof:'شوف بطاقة من يد خصمك، لحالك.',nashal:'خذ بطاقة من يد خصمك.',sanad:'درع يحميك من أول قدرة ضدك.',mosarref:'تخلّص من بطاقة إضافية.',mokhabbes:'بدّل بطاقة مع خصمك.',alkabeer:'خلّ خصمك يسحب بطاقة.'};
export const CardGuide:React.FC=()=> <section className="card-guide" aria-label="جميع البطاقات وقدراتها"><h3>تعرّف على البطاقات</h3><p>ما تحتاج تحفظها. وصف كل بطاقة موجود عليها.</p><div className="card-guide-grid">{CHARACTER_LIST.map(c=><article className="card-guide-item" key={c.id}><img src={c.assetPath} alt={`شخصية ${c.nameAr}`}/><div><h4>{c.nameAr}</h4><p>{simple[c.id]}</p></div></article>)}</div></section>;
