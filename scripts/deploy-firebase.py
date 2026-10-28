#!/usr/bin/env python3
"""Reproducible Firebase Hosting + Cloud Run deployment using gcloud user auth.

Existing setup: python3 scripts/deploy-firebase.py --project PROJECT --site SITE
First setup: add --bootstrap to create only the named Rallypoint resources.
Billing must already be enabled on the selected Firebase/GCP project.
No service account keys or Firebase CLI login token are created.
"""
import argparse,base64,json,pathlib,secrets,subprocess,time,urllib.error,urllib.request
A=argparse.ArgumentParser(description=__doc__)
A.add_argument('--project',required=True);A.add_argument('--site',required=True)
A.add_argument('--region',default='us-central1');A.add_argument('--bootstrap',action='store_true')
a=A.parse_args();ROOT=pathlib.Path(__file__).resolve().parents[1];P=a.project;SA=f'rallypoint-runtime@{P}.iam.gserviceaccount.com';URL=f'https://{a.site}.web.app'
revision=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
if subprocess.check_output(['git','status','--porcelain'],cwd=ROOT,text=True).strip():
 raise RuntimeError('Commit the reviewed source before deploying. The deployment must be reproducible from Git.')
def run(args,**kwargs):return subprocess.run(['gcloud',*args,'--project',P,'--quiet'],check=True,**kwargs)
def capture(args):return subprocess.check_output(['gcloud',*args],text=True).strip()
TOKEN=capture(['auth','print-access-token'])
def request(method,url,body=None,allow=()):
 payload=None if body is None else json.dumps(body).encode()
 try:
  with urllib.request.urlopen(urllib.request.Request(url,data=payload,method=method,headers={'Authorization':'Bearer '+TOKEN,'x-goog-user-project':P,'Content-Type':'application/json'}),timeout=60) as r:return json.load(r) if r.status!=204 else {}
 except urllib.error.HTTPError as e:
  if e.code in allow:return None
  data=json.load(e);raise RuntimeError(f"Cloud operation failed ({e.code}): {data.get('error',{}).get('message','Unknown error')}") from None
def poll(url):
 for _ in range(120):
  state=request('GET',url)
  if state.get('done'):
   if state.get('error'):raise RuntimeError('Cloud resource creation failed')
   return state.get('response',{})
  time.sleep(2)
 raise RuntimeError('Cloud resource creation did not finish in time')
def project_role(role,condition=None):
 cmd=['projects','add-iam-policy-binding',P,'--member','serviceAccount:'+SA,'--role',role,'--condition',condition or 'None']
 run(cmd,stdout=subprocess.DEVNULL)
if a.bootstrap:
 run(['services','enable','firebase.googleapis.com','firebasehosting.googleapis.com','firebaserules.googleapis.com','identitytoolkit.googleapis.com','securetoken.googleapis.com','firestore.googleapis.com','run.googleapis.com','cloudbuild.googleapis.com','artifactregistry.googleapis.com','secretmanager.googleapis.com','cloudtasks.googleapis.com'])
 base='https://firebase.googleapis.com/v1beta1/projects/'+P
 if request('GET',base,allow=(404,)) is None:
  op=request('POST',base+':addFirebase',{});poll('https://firebase.googleapis.com/v1beta1/'+op['name'])
 request('POST',f'https://firebasehosting.googleapis.com/v1beta1/projects/{P}/sites?siteId={a.site}',{'type':'USER_SITE'},allow=(409,))
 db=f'https://firestore.googleapis.com/v1/projects/{P}/databases/rallypoint'
 if request('GET',db,allow=(404,)) is None:
  op=request('POST',f'https://firestore.googleapis.com/v1/projects/{P}/databases?databaseId=rallypoint',{'type':'FIRESTORE_NATIVE','locationId':'nam5'});poll('https://firestore.googleapis.com/v1/'+op['name'])
 if subprocess.run(['gcloud','iam','service-accounts','describe',SA,'--project',P],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode:
  run(['iam','service-accounts','create','rallypoint-runtime','--display-name','Rallypoint runtime'])
 for name in ['rallypoint-token-key','rallypoint-webhook-secret']:
  if subprocess.run(['gcloud','secrets','describe',name,'--project',P],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode:
   run(['secrets','create',name,'--replication-policy','automatic'])
   value=base64.b64encode(secrets.token_bytes(32)) if name=='rallypoint-token-key' else secrets.token_hex(32).encode()
   run(['secrets','versions','add',name,'--data-file=-'],input=value,stdout=subprocess.DEVNULL)
  run(['secrets','add-iam-policy-binding',name,'--member','serviceAccount:'+SA,'--role','roles/secretmanager.secretAccessor'],stdout=subprocess.DEVNULL)
 role='rallypointSessionIssuer'
 if subprocess.run(['gcloud','iam','roles','describe',role,'--project',P],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode:
  run(['iam','roles','create',role,'--title','Rallypoint session issuer','--permissions','firebaseauth.users.get,firebaseauth.users.createSession','--stage','GA'])
 project_role(f'projects/{P}/roles/{role}')
 project_role('roles/datastore.user',f"expression=resource.name=='projects/{P}/databases/rallypoint',title=rallypoint_database")
 q=f'https://cloudtasks.googleapis.com/v2/projects/{P}/locations/{a.region}/queues/rallypoint-replies'
 if request('GET',q,allow=(404,)) is None:request('POST',q.rsplit('/queues/',1)[0]+'/queues',{'name':q.split('/v2/')[1],'rateLimits':{'maxDispatchesPerSecond':5,'maxConcurrentDispatches':5},'retryConfig':{'maxAttempts':5,'minBackoff':'2s','maxBackoff':'30s','maxDoublings':4}})
 run(['tasks','queues','add-iam-policy-binding','rallypoint-replies','--location',a.region,'--member','serviceAccount:'+SA,'--role','roles/cloudtasks.enqueuer'],stdout=subprocess.DEVNULL)
 for collection in ['receipts','outbox','oauthStates','opens','rateLimits']:
  run(['firestore','fields','ttls','update','expiresAt','--collection-group',collection,'--database','rallypoint','--enable-ttl','--async'])
 # Modify only the requested providers and append domains. Existing providers stay intact.
 authurl=f'https://identitytoolkit.googleapis.com/admin/v2/projects/{P}/config'
 auth=request('GET',authurl+'?fields=authorizedDomains')
 domains=list(dict.fromkeys(auth.get('authorizedDomains',[])+[a.site+'.web.app',a.site+'.firebaseapp.com']))
 request('PATCH',authurl+'?updateMask=authorizedDomains,signIn.email.enabled,signIn.email.passwordRequired,signIn.anonymous.enabled',{'authorizedDomains':domains,'signIn':{'email':{'enabled':True,'passwordRequired':True},'anonymous':{'enabled':True}}})
 number=capture(['projects','describe',P,'--format=value(projectNumber)'])
 rules=request('POST',f'https://firebaserules.googleapis.com/v1/projects/{P}/rulesets',{'source':{'files':[{'name':'firestore.rules','content':(ROOT/'firestore.rules').read_text()}]},'attachment_point':f'firestore.googleapis.com/projects/{number}/databases/rallypoint'})
 rel={'name':f'projects/{P}/releases/cloud.firestore/rallypoint','rulesetName':rules['name']}
 existing=request('PATCH','https://firebaserules.googleapis.com/v1/'+rel['name'],{'release':rel,'updateMask':'rulesetName'},allow=(404,))
 if existing is None:request('POST',f'https://firebaserules.googleapis.com/v1/projects/{P}/releases',rel)
apps=request('GET',f'https://firebase.googleapis.com/v1beta1/projects/{P}/webApps').get('apps',[])
app=next((x for x in apps if x.get('displayName')=='Rallypoint'),None)
if app is None:
 op=request('POST',f'https://firebase.googleapis.com/v1beta1/projects/{P}/webApps',{'displayName':'Rallypoint'});app=poll('https://firebase.googleapis.com/v1beta1/'+op['name'])
config=request('GET','https://firebase.googleapis.com/v1beta1/'+app['name']+'/config')
config={k:config[k] for k in ['apiKey','authDomain','projectId','appId','messagingSenderId'] if k in config}
env={'GOOGLE_CLOUD_PROJECT':P,'FIRESTORE_DATABASE_ID':'rallypoint','FIREBASE_WEB_CONFIG':json.dumps(config,separators=(',',':')),'SITE_URL':URL,'CLOUD_TASKS_QUEUE':'rallypoint-replies','CLOUD_TASKS_LOCATION':a.region,'NEXT_TELEMETRY_DISABLED':'1','RELEASE_REVISION':revision}
# Updates preserve Twitch credentials already configured in the service.
run(['run','deploy','rallypoint','--region',a.region,'--source',str(ROOT),'--allow-unauthenticated','--service-account',SA,'--min-instances','0','--max-instances','1','--memory','512Mi','--cpu','1','--concurrency','40','--timeout','30','--update-env-vars','^|^'+'|'.join(k+'='+v for k,v in env.items()),'--update-secrets','TOKEN_ENCRYPTION_KEY=rallypoint-token-key:latest,TWITCH_WEBHOOK_SECRET=rallypoint-webhook-secret:latest'])
# Refresh the user token after a potentially long source build.
TOKEN=capture(['auth','print-access-token'])
host=f'https://firebasehosting.googleapis.com/v1beta1/sites/{a.site}'
version=request('POST',host+'/versions',{'config':{'rewrites':[{'glob':'**','run':{'serviceId':'rallypoint','region':a.region}}]}})
request('PATCH','https://firebasehosting.googleapis.com/v1beta1/'+version['name']+'?updateMask=status',{'status':'FINALIZED'})
request('POST',host+'/releases?versionName='+version['name'],{'message':'Rallypoint native Next release'})
with urllib.request.urlopen(URL+'/api/health',timeout=60) as r:assert json.load(r)['status']=='ok','Deployed health check failed'
print('Deployment verified: '+URL)
