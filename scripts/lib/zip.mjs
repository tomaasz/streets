// Minimalny czytnik ZIP (deflate/store) — tyle, ile trzeba, żeby wyjąć
// pojedynczy plik XML z paczki BDOT10k bez dokładania zależności.
import { inflateRawSync } from 'node:zlib';

const EOCD = 0x06054b50;
const EOCD64 = 0x06064b50;
const CEN = 0x02014b50;

function znajdzEocd(buf) {
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) {
    if (buf.readUInt32LE(i) === EOCD) return i;
  }
  throw new Error('ZIP: nie znaleziono End Of Central Directory');
}

/** @returns {{nazwa:string, metoda:number, offset:number, spakowany:number, rozpakowany:number}[]} */
export function listaWpisow(buf) {
  const eocd = znajdzEocd(buf);
  let liczba = buf.readUInt16LE(eocd + 10);
  let start = buf.readUInt32LE(eocd + 16);

  // ZIP64 — paczki BDOT bywają duże.
  if (start === 0xffffffff || liczba === 0xffff) {
    for (let i = eocd - 20; i >= 0; i--) {
      if (buf.readUInt32LE(i) === EOCD64) {
        liczba = Number(buf.readBigUInt64LE(i + 32));
        start = Number(buf.readBigUInt64LE(i + 48));
        break;
      }
    }
  }

  const wpisy = [];
  let p = start;
  for (let i = 0; i < liczba; i++) {
    if (buf.readUInt32LE(p) !== CEN) break;
    const metoda = buf.readUInt16LE(p + 10);
    const spakowany = buf.readUInt32LE(p + 20);
    const rozpakowany = buf.readUInt32LE(p + 24);
    const dlNazwy = buf.readUInt16LE(p + 28);
    const dlExtra = buf.readUInt16LE(p + 30);
    const dlKom = buf.readUInt16LE(p + 32);
    const offset = buf.readUInt32LE(p + 42);
    const nazwa = buf.toString('utf8', p + 46, p + 46 + dlNazwy);
    wpisy.push({ nazwa, metoda, offset, spakowany, rozpakowany });
    p += 46 + dlNazwy + dlExtra + dlKom;
  }
  return wpisy;
}

export function rozpakuj(buf, wpis) {
  const dlNazwy = buf.readUInt16LE(wpis.offset + 26);
  const dlExtra = buf.readUInt16LE(wpis.offset + 28);
  const dane = wpis.offset + 30 + dlNazwy + dlExtra;
  const surowe = buf.subarray(dane, dane + wpis.spakowany);
  return wpis.metoda === 0 ? surowe : inflateRawSync(surowe);
}
