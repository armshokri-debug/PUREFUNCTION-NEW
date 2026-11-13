// Authenticated text-to-USDA matching. Never writes meal records. Only returns estimates.
// Secrets: OPENAI_API_KEY, USDA_API_KEY. No secrets in client bundle.
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import { cors, json } from '../_shared/email.ts';
const valid = (s: unknown) => typeof s === 'string' && s.trim().length > 0 && s.length <= 2000;
const newId = () => crypto.randomUUID();

Deno.serve(async req => {
 if(req.method === 'OPTIONS') return new Response('ok', {headers:cors});
 if(req.method !== 'POST') return json(405,{error:'Method not allowed'});
 const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i,'');
 const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 const who = await admin.auth.getUser(jwt);
 if(!who.data.user) return json(401,{error:'Sign in required'});
 const {description} = await req.json().catch(()=>({}));
 if(!valid(description)) return json(400,{error:'Describe your food (max 2000 characters)'});
 const aiKey = Deno.env.get('OPENAI_API_KEY');
 const usdaKey = Deno.env.get('USDA_API_KEY');
 if(!aiKey || !usdaKey) return json(503,{error:'Analysis unavailable. Enter foods manually.'});
 try {
  const response = await fetch('https://api.openai.com/v1/chat/completions',{
   method:'POST',headers:{Authorization:`Bearer ${aiKey}`,'Content-Type':'application/json'},
   body:JSON.stringify({model:Deno.env.get('OPENAI_FOOD_MODEL') || 'gpt-6-luna',reasoning_effort:'none',response_format:{type:'json_object'},messages:[
    {role:'system',content:'Identify individual foods and portions. Return JSON {foods:[{name:string,quantity:number,unit:"g"|"oz"|"cup"|"tbsp"|"piece"|"serving",grams:number|null,state:"raw"|"cooked"|"unknown",assumptions:string}],questions:string[]}. No nutritional values. Only ask material ambiguities (oil, butter, sauces, milk, cooking method, raw/cooked, eaten portion, missing serving size). For mixed dishes like ghormeh sabzi, kebab plates, soups or restaurant meals, request a recipe, restaurant name or portion explanation when needed. Never invent confidence percentages.'},
    {role:'user',content:String(description)}]})
  });
  if(!response.ok) throw Error('AI unavailable');
  const parsed = await response.json();
  const result = JSON.parse(parsed.choices?.[0]?.message?.content ?? '{}');
  if(!Array.isArray(result.foods)) throw Error('No foods found');
  const foods = result.foods.slice(0,20);
  const items = [];
  for (const f of foods) {
   const name = String(f.name ?? '').slice(0,180);
   if(!name) continue;
   const query = await fetch('https://api.nal.usda.gov/fdc/v1/foods/search?api_key='+encodeURIComponent(usdaKey),{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({query:name,pageSize:6,dataType:['Foundation','SR Legacy','Survey (FNDDS)']})
   });
   const match = query.ok ? (await query.json()).foods?.[0] : null;
   const list = match?.foodNutrients ?? [];
   const nutrient = (id:number, fallback:string) => {
    const n = list.find((x:{nutrientId?:number,nutrientName?:string})=>x.nutrientId===id || x.nutrientName===fallback);
    return typeof n?.value==='number' && Number.isFinite(n.value) ? n.value/100 : null;
   };
   const kcalPerGram = nutrient(1008,'Energy');
   const proteinPerGram = nutrient(1003,'Protein');
   const grams = typeof f.grams==='number' && f.grams>0 && f.grams<5000 ? f.grams : null;
   const unit = ['g','oz','cup','tbsp','piece','serving'].includes(f.unit)?f.unit:'serving';
   const quantity = typeof f.quantity==='number' && f.quantity>0 ? f.quantity:1;
   items.push({id:newId(),name,quantity,unit,grams,state:['raw','cooked'].includes(f.state)?f.state:'unknown',
    kcal: kcalPerGram !== null && grams !== null ? Math.round(kcalPerGram*grams):null,
    protein:proteinPerGram !== null && grams !== null ? Math.round(proteinPerGram*grams*10)/10:null,
    source: match?'USDA':'generic',sourceId:match?String(match.fdcId):null,
    assumptions:String(f.assumptions??'')+(grams===null?'; portion weight unconfirmed':''),version:'food-v1',kcalPerGram,proteinPerGram});
  }
  return json(200,{items,questions:Array.isArray(result.questions)?result.questions.slice(0,5):[]});
 }catch{ return json(503,{error:'Analysis unavailable. Enter foods manually.'}); }
});
