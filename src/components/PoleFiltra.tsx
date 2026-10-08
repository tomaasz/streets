'use client';
import { useEffect, useRef, useState, type SelectHTMLAttributes, type InputHTMLAttributes } from 'react';

export function WyborFiltra({defaultValue='',children,...props}:SelectHTMLAttributes<HTMLSelectElement>) {
  const [value,setValue]=useState(defaultValue);
  useEffect(()=>setValue(defaultValue),[defaultValue]);
  return <select {...props} value={value} onChange={e=>setValue(e.target.value)}>{children}</select>;
}

export function TekstFiltra({defaultValue='',...props}:InputHTMLAttributes<HTMLInputElement>) {
  const [value,setValue]=useState(defaultValue);
  const input=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(input.current!==document.activeElement) setValue(defaultValue);},[defaultValue]);
  return <input ref={input} {...props} value={value} onChange={e=>setValue(e.target.value)} />;
}
