import { build } from 'esbuild';
await build({entryPoints:['supabase/functions/sadooh-api/index.ts'],bundle:true,format:'esm',platform:'neutral',target:'es2022',outfile:'supabase/functions/sadooh-api/bundle.ts',external:['@supabase/supabase-js']});
