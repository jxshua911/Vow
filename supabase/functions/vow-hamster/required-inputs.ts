export type RequiredInput={key:string;question:string;why?:string};

export function normaliseRequiredInputs(value:unknown):RequiredInput[]{
  return Array.isArray(value)
    ? value.slice(0,20).map((x:any)=>({
        key:typeof x?.key==='string'?x.key.trim().slice(0,80):'',
        question:typeof x?.question==='string'?x.question.trim().slice(0,500):'',
        why:typeof x?.why==='string'?x.why.trim().slice(0,500):''
      })).filter((x:RequiredInput)=>x.key&&x.question)
    : [];
}

export function missingRequiredInputKeys(requiredInputs:RequiredInput[], rows:Array<{key?:unknown;answer?:unknown}>){
  const answered=new Set(
    rows
      .map(x=>({key:typeof x?.key==='string'?x.key.trim().slice(0,80):'',answer:typeof x?.answer==='string'?x.answer.trim():''}))
      .filter(x=>x.key&&x.answer)
      .map(x=>x.key)
  );
  return requiredInputs.map(x=>x.key).filter(key=>!answered.has(key));
}
