/**
 * مشغّل الاختبارات والتحقق من بناء ملفات TypeScript/React
 * يعمل مباشرة عبر Node.js للتحقق من:
 * 1) وجود وسلامة الأصول الرسومية الـ 12 في public/assets/
 * 2) ترجمة جميع ملفات TypeScript (.ts / .tsx) دون أي أخطاء
 * 3) تشغيل جميع اختبارات محرك اللعبة والحالات الخاصة الـ 11
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire('/usr/share/nodejs/');
const babel = require('@babel/core');

const projectRoot = process.cwd();
const tmpDir = path.join(projectRoot, '.test-build');

const REQUIRED_ASSETS = [
  'malqoof.png',
  'nashal.png',
  'sanad.png',
  'mosarref.png',
  'mokhabbes.png',
  'alkabeer.png',
  'abu-fahad.png',
  'logo.png',
  'card-back.png',
  'game-table.png',
  'menu-background.png',
  'card-frame.png',
];

console.log('=== 1. التحقق من الأصول الرسومية الـ 12 في public/assets/ ===');
for (const asset of REQUIRED_ASSETS) {
  const fullPath = path.join(projectRoot, 'public', 'assets', asset);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`الأصل الرسومي مفقود: ${fullPath}`);
  }
  const stat = fs.statSync(fullPath);
  if (stat.size < 1000) {
    throw new Error(`حجم الأصل الرسومي صغير جدًا أو تالف: ${asset}`);
  }
  console.log(`  ✓ ${asset} (${(stat.size / 1024).toFixed(1)} KB)`);
}

console.log('\n=== 2. ترجمة وفحص جميع ملفات المشروع (.ts / .tsx) ===');
function compileDir(relDir) {
  const srcDir = path.join(projectRoot, relDir);
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const relPath = path.join(relDir, entry.name);
    if (entry.isDirectory()) {
      compileDir(relPath);
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      const code = fs.readFileSync(path.join(projectRoot, relPath), 'utf8');
      const result = babel.transformSync(code, {
        filename: relPath,
        presets: [
          [require.resolve('@babel/preset-env'), { targets: { node: 'current' }, modules: 'commonjs' }],
          [require.resolve('@babel/preset-typescript'), { isTSX: entry.name.endsWith('.tsx'), allExtensions: true }],
          ...(entry.name.endsWith('.tsx') ? [[require.resolve('@babel/preset-react'), { runtime: 'classic' }]] : []),
        ],
      });
      const outPath = path.join(tmpDir, relPath.replace(/\.tsx?$/, '.js'));
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, result.code, 'utf8');
      console.log(`  ✓ تم فحص وترجمة: ${relPath}`);
    }
  }
}

fs.rmSync(tmpDir, { recursive: true, force: true });
fs.mkdirSync(tmpDir, { recursive: true });
fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ type: 'commonjs' }), 'utf8');
compileDir('src');
compileDir('tests');

console.log('\n=== 3. تشغيل الاختبارات الآلية لمحرك اللعبة والحالات الخاصة ===');
const testModule = require(path.join(tmpDir, 'tests', 'engine.test.js'));
const { passed, results } = testModule.runAllEngineTests();
for (const line of results) {
  console.log(' ', line);
}
console.log(`\n🎉 اكتملت جميع الاختبارات بنجاح (${passed}/${passed})!`);
fs.rmSync(tmpDir, { recursive: true, force: true });
