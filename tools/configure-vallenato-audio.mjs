import fs from 'node:fs';
const path='public/instrument/manifest.json',manifest=JSON.parse(fs.readFileSync(path,'utf8'));
manifest.profiles=manifest.profiles.filter(p=>!p.id.startsWith('vallenato'));
manifest.profiles.push({id:'vallenato',label:'Vallenato · virtual reed ensemble',cutoff:12500,ranks:[{semitones:0,cents:0,gain:.54},{semitones:0,cents:-6,gain:.23},{semitones:0,cents:6,gain:.23}],rendering:'Runtime frequency-dependent reed spread; separate sampled octave ranks for bass and dry chord voicing. Not an independently recorded Corona III.',reference:'https://hohner.de/es/instrumentos/acordeones/diatonicas/corona/corona-iii'});
manifest.profiles.push({id:'vallenato-high',label:'Vallenato agudo · virtual upper reed',cutoff:15000,ranks:[{semitones:0,cents:0,gain:.46},{semitones:0,cents:6,gain:.18},{semitones:12,cents:0,gain:.36}],rendering:'Virtual middle/middle/high sample ranks: a +12-semitone upper reed enriches the melody without changing the button fundamental. Bass and chord maps remain unchanged. Not a Mezquite sample or an independent instrument recording.'});
fs.writeFileSync(path,JSON.stringify(manifest,null,2)+'\n');
console.log('Configured the explicitly virtual Vallenato reed profile; preserved source recordings.');
