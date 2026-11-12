import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
const directory='integrations/heftruckopleiding-keuringsagenda',zip=new AdmZip();
for(const file of fs.readdirSync(directory))zip.addLocalFile(path.join(directory,file),'heftruckopleiding-keuringsagenda');
fs.mkdirSync('generated',{recursive:true});const target='generated/heftruckopleiding-keuringsagenda-v1.0.0.zip';zip.writeZip(target);console.log(path.resolve(target));
