import fs from 'node:fs';
const path='public/instrument/manifest.json',manifest=JSON.parse(fs.readFileSync(path,'utf8'));
manifest.profiles=manifest.profiles.filter(p=>p.id!=='vallenato');
manifest.profiles.push({id:'vallenato',label:'Vallenato · virtual reed ensemble',cutoff:12500,ranks:[{semitones:0,cents:0,gain:.54},{semitones:0,cents:-6,gain:.23},{semitones:0,cents:6,gain:.23}],rendering:'Runtime frequency-dependent reed spread; separate sampled octave ranks for bass and dry chord voicing. Not an independently recorded Corona III.',reference:'https://hohner.de/es/instrumentos/acordeones/diatonicas/corona/corona-iii'});
fs.writeFileSync(path,JSON.stringify(manifest,null,2)+'\n');
console.log('Configured the explicitly virtual Vallenato reed profile; preserved source recordings.');
