import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {verifyPresentation} from './guard.mjs';

export const reviewPath = '.delivery/request.json';
export const isReviewPath = file => file===reviewPath || /^\.delivery\/requests\/[a-z0-9-]+\.json$/.test(file);
export const reviewFilename = branch => `.delivery/requests/${crypto.createHash('sha256').update(branch).digest('hex').slice(0,20)}.json`;
export const reservedEffects = ['productionData', 'database', 'security', 'authentication', 'communications', 'integrations', 'costs', 'infrastructure'];
const git = (repo, args) => execFileSync('git', ['-C', repo, ...args], {encoding:'utf8', maxBuffer:30e6});
export function changedFiles(repo, base, head) {
  return git(repo,['diff','--name-status','--no-renames',base,head]).trim().split('\n').filter(Boolean).map(line => {
    const [status, filename] = line.split('\t');
    if (!/^[AMD]$/.test(status) || !filename || /[\\\r\n]/.test(filename)) throw new Error('Ruta o estado de archivo no admitido');
    return {status, filename};
  });
}
export function changeDigest(repo, base, head) {
  const hash = crypto.createHash('sha256');
  for (const {status,filename} of changedFiles(repo,base,head).filter(x=>!isReviewPath(x.filename)).sort((a,b)=>a.filename<b.filename?-1:a.filename>b.filename?1:0)) {
    hash.update(status+'\0'+filename+'\0');
    // Hash the actual diff, so an unchanged review cannot approve new edits.
    hash.update(git(repo,['diff','--no-ext-diff','--no-textconv','--no-renames','--full-index','--binary','--no-color','--unified=0',base,head,'--',filename]).replace(/\r\n/g,'\n'));
  }
  return hash.digest('hex');
}
export function validateReview(review, digest) {
  if (review.version!==1 || review.scope!=='application' || review.digest!==digest) throw new Error('Falta revisión funcional vigente del cambio exacto');
  for (const key of ['request','reason','verification']) if (typeof review[key]!=='string' || review[key].trim().length<15) throw new Error(`Falta explicación de ${key}`);
  if (!review.effects || reservedEffects.some(key=>review.effects[key]!==false)) throw new Error('Efecto reservado: requiere autorización específica y otra ruta');
  if (!Array.isArray(review.tests) || !review.tests.length || review.tests.length>20) throw new Error('La funcionalidad necesita pruebas focalizadas');
  for (const file of review.tests) if (typeof file!=='string' || !/^(scripts|src)\/[\w./-]+\.(mjs|cjs|js)$/.test(file) || file.split('/').some(p=>p==='.' || p==='..') || /(?:^|[/-])(db|production|linked)(?:[./-]|$)/i.test(file)) throw new Error('Prueba no admitida: usar archivos Node locales sin datos reales');
  return review;
}
export function verifyDelivery(repo,base,head) {
  try { return {scope:'presentation', paths:verifyPresentation(repo,base,head), tests:[]}; } catch (presentationError) {
    const changes=changedFiles(repo,base,head);
    const reviews=changes.filter(x=>isReviewPath(x.filename));
    if (reviews.length!==1 || !['A','M'].includes(reviews[0].status)) throw new Error(`${presentationError.message}. Preparar una revisión funcional por tarea con review.mjs.`);
    for (const {filename} of changes) {
      if (isReviewPath(filename)) continue;
      if (!/^(src\/.*\.(tsx?|jsx?|css)|scripts\/.*\.(mjs|cjs|js)|docs\/.*\.md|public\/.*\.(svg|png|jpe?g|webp|ico))$/.test(filename)
          || /(?:^|\/)(?:auth|security|permissions?|notifications?|integrations|supabase)(?:\/|[.-])/i.test(filename)
          || /(?:auth|permission|security|notification|whatsapp|smoobu|hotelier|sync)/i.test(filename)) throw new Error(`Archivo reservado fuera de entrega automática: ${filename}`);
      const diff=git(repo,['diff','--no-ext-diff','--unified=0',base,head,'--',filename]).split('\n').filter(line=>/^[+-](?![+-])/.test(line)).join('\n');
      if (/(?:service_role|SUPABASE_SERVICE|BEGIN .*PRIVATE KEY|\.auth\b|\.functions\.invoke\b|\.(?:insert|update|upsert|delete)\s*\(|\b(?:sendEmail|sendWhatsApp|sendNotification|grant|revoke|row level security)\b)/i.test(diff)) throw new Error(`Revisar efecto reservado en ${filename}`);
    }
    const review=validateReview(JSON.parse(git(repo,['show',`${head}:${reviews[0].filename}`])),changeDigest(repo,base,head));
    for (const file of review.tests) git(repo,['cat-file','-e',`${head}:${file}`]);
    return {scope:'application',paths:changes.filter(x=>!isReviewPath(x.filename)).map(x=>x.filename),tests:review.tests,review};
  }
}
