"""Scoped read API. No SQL, generic HTTP, credentials in output or write counterpart."""
import ctypes,json,os,urllib.request,urllib.error
from ctypes import wintypes
from pathlib import Path
PROFILES=('limpatexconsultor','limpatexoperaciones','limpatexrentabilidad','limpatexcomercial')
ROOT=Path(os.environ.get('HERMES_INSTALL_ROOT',r'C:\Users\danig\AppData\Local\Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache\Local\hermes'))
APP='https://gestionlimpatex.vercel.app/asistentes'
class Blob(ctypes.Structure):_fields_=[('size',wintypes.DWORD),('data',ctypes.POINTER(ctypes.c_ubyte))]
def protect(data:bytes,decrypt=False)->bytes:
 if os.name!='nt':raise RuntimeError('Esta instalación requiere el almacén cifrado de Windows.')
 buffer=ctypes.create_string_buffer(data);source=Blob(len(data),ctypes.cast(buffer,ctypes.POINTER(ctypes.c_ubyte)));out=Blob()
 fn=ctypes.windll.crypt32.CryptUnprotectData if decrypt else ctypes.windll.crypt32.CryptProtectData
 if not fn(ctypes.byref(source),None,None,None,None,1,ctypes.byref(out)):raise RuntimeError('No se pudo acceder a la credencial cifrada.')
 try:return ctypes.string_at(out.data,out.size)
 finally:ctypes.windll.kernel32.LocalFree(out.data)
def credential(profile):
 if profile not in PROFILES:raise ValueError('Perfil no autorizado.')
 return protect((ROOT/'profiles'/profile/'integrations/limpatex/credential.dpapi').read_bytes(),True).decode()
class Client:
 def __init__(self,profile):
  if profile not in PROFILES:raise ValueError('Perfil no autorizado.')
  self.profile=profile;self.token=credential(profile)
  self.config=json.loads((Path(__file__).parent/'project.json').read_text(encoding='utf-8'))
  if self.config['url']!='https://qyipyygojlfhdghnraus.supabase.co':raise ValueError('Proyecto inesperado.')
 def read(self,resource='permisos',**filters):
  allowed={'from_date','to_date','search','record_id','limit','offset'}
  if set(filters)-allowed:raise ValueError('Solo se admiten filtros de consulta.')
  payload={'p_token':self.token,'p_resource':resource,'p_from':filters.get('from_date'),'p_to':filters.get('to_date'),
    'p_search':filters.get('search',''),'p_id':filters.get('record_id'),'p_limit':filters.get('limit',50),'p_offset':filters.get('offset',0)}
  request=urllib.request.Request(self.config['url']+'/rest/v1/rpc/limpatex_assistant_read',data=json.dumps(payload).encode(),
    headers={'apikey':self.config['anon_key'],'Content-Type':'application/json'},method='POST')
  try:
   with urllib.request.urlopen(request,timeout=20) as response:result=json.load(response)
  except urllib.error.HTTPError as exc:raise RuntimeError('Consulta rechazada por el servidor (HTTP '+str(exc.code)+'). No ampliar permisos ni cambiar de perfil.') from None
  except OSError:raise RuntimeError('No se pudo conectar con Limpatex; no hay un resultado confirmado.') from None
  if result.get('read_only') is not True or result.get('profile')!=self.profile:raise RuntimeError('Identidad o respuesta de lectura inesperada.')
  return result
 def open_view(self):
  import sys,contextlib
  sys.path.insert(0,str(ROOT/'hermes-agent'));import hermes_bootstrap
  from tools.browser_use_cli import browser_exec
  session='limpatex-lectura-'+self.profile.removeprefix('limpatex')
  code='''import sys,json,time
sys.path.insert(0,INTEGRATION)
from read_access import credential
new_tab(APP)
wait_for_load()
if js("location.origin + location.pathname") != APP:
    raise RuntimeError("La vista no está en el origen autorizado")
js("sessionStorage.setItem('limpatex-assistant-readonly-v1',"+json.dumps(credential(PROFILE))+")")
goto_url(APP)
wait_for_load()
for _ in range(30):
    if js("document.querySelector('[data-profile]')?.getAttribute('data-profile')") == PROFILE:
        break
    time.sleep(1)
else:
    raise RuntimeError("No se confirmó la sesión de lectura")
print(json.dumps({"profile":PROFILE,"read_only":True,"url":APP,"title":js("document.querySelector('h1')?.innerText")}))
'''.replace('INTEGRATION',repr(str(Path(__file__).parent))).replace('PROFILE',repr(self.profile)).replace('APP',repr(APP))
  with contextlib.redirect_stdout(sys.stderr):result=browser_exec(code,session=session,timeout_s=65,task_id=session)
  if not result.get('success'):raise RuntimeError('No se pudo abrir o verificar la vista de consulta. Revisar el navegador de Hermes.')
  return {'profile':self.profile,'read_only':True,'url':APP,'browser_session':session,
    'instruction':'Usa browser_exec con esta misma session para revisar secciones, filtros y pantallas. No contiene permisos de edición.'}
