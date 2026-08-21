#!/usr/bin/env python3
"""Wyciaga z PDF-ow uchwal wykaz drog zaliczonych do kategorii drog gminnych.

Uchwaly maja dwa uklady:
  A. tabela w zalaczniku — naglowek konczy sie na "Oznaczenie odcinka",
     potem pozycje "<lp>. <nazwa> <dlugosc> <opis odcinka>";
  B. lista w tresci § 1 — "<lp>) droga w miejscowosci <M>[ - ul. <U>]
     o dlugosci <D> km - odcinek <opis>;".

Numeracja w ukladzie A miesza sie z numerami dzialek i nazwami ulic
("3 Maja"), wiec marker przyjmujemy tylko wtedy, gdy numer jest kolejnym
w ciagu.
"""
import json
import re
import sys
from pathlib import Path

from pypdf import PdfReader

STOPKA = re.compile(r"Id: [0-9A-F-]+\.\s*Podpisany\s*Strona \d+")
KONIEC_NAGLOWKA = re.compile(r"Oznaczenie odcinka")
MARKER = re.compile(r"(\d{1,3})\.\s")
DLUGOSC = re.compile(r"(\d+,\d+)")
NUMER_DROGI = re.compile(r"^\d{3,6}[A-Z]$")
MIES = {
    "stycznia": 1, "lutego": 2, "marca": 3, "kwietnia": 4, "maja": 5,
    "czerwca": 6, "lipca": 7, "sierpnia": 8, "września": 9,
    "października": 10, "listopada": 11, "grudnia": 12,
}


def tekst(sciezka: Path) -> str:
    t = " ".join(
        " ".join((s.extract_text() or "") for s in PdfReader(str(sciezka)).pages).split()
    )
    return STOPKA.sub(" ", t)


def naglowek_aktu(t: str) -> dict:
    m = re.search(
        r"UCHWA[ŁL]A NR ([\w/]+)\s+(RADY [^0-9]+?)\s+z dnia (\d{1,2}) (\w+) (\d{4}) r\.\s*"
        r"(w sprawie[^§]*?)(?:Na podstawie|§)",
        t,
    )
    if not m:
        return {}
    return {
        "numer": m.group(1),
        "organ_zrodlowy": " ".join(m.group(2).split()),
        "data_podjecia": f"{m.group(5)}-{MIES.get(m.group(4).lower(), 0):02d}-{int(m.group(3)):02d}",
        "tytul": " ".join(m.group(6).split()).rstrip(". "),
    }


def rozbij_nazwe(surowa: str, domyslna_miejscowosc: str | None) -> dict:
    """Nazwa z tabeli bywa sama („Akacjowa”), z miejscowoscia („Drogoszewo
    ul. Szczesliwa”), przebiegiem miedzy wsiami („Deskurow – Tumanek”),
    numerem drogi („4412W”) albo sama miejscowoscia — wtedy chodzi o droge
    bez nazwy wlasnej. W zalaczniku miejskim domyslna miejscowosc jest
    znana, poza miastem trzeba ja odczytac z samej nazwy."""
    s = " ".join(surowa.split())
    if not s:
        return {"numer_drogi": None, "ulica": None,
                "miejscowosc": domyslna_miejscowosc, "typ": "brak_nazwy"}
    if NUMER_DROGI.match(s):
        return {"numer_drogi": s, "ulica": None, "miejscowosc": None, "typ": "numer"}
    m = re.match(r"^(.+?)\s+(?:ul\.|al\.|pl\.)\s*(.+)$", s)
    if m:
        return {"numer_drogi": None, "ulica": m.group(2).strip(),
                "miejscowosc": m.group(1).strip(), "typ": "ulica"}
    if re.search(r"\s[–—-]\s", s):
        return {"numer_drogi": None, "ulica": None, "miejscowosc": None,
                "typ": "przebieg", "przebieg": s}
    if domyslna_miejscowosc is None:
        # załącznik wiejski bez „ul.” — nazwa to miejscowość, nie ulica
        return {"numer_drogi": None, "ulica": None, "miejscowosc": s,
                "typ": "bez_nazwy"}
    return {"numer_drogi": None, "ulica": s, "miejscowosc": domyslna_miejscowosc,
            "typ": "ulica"}


def pozycje_tabeli(fragment: str, miejscowosc: str | None) -> list:
    # Numeracja w zrodle bywa niechlujna — w XXVII/264/16 pozycja 41 stoi bez
    # kropki i lancuch sie na niej urywal. Szukamy wiec najpierw scisle
    # ("41. "), a dopiero gdy takiego markera nie ma, dopuszczamy sam numer,
    # i tylko wtedy, gdy w poblizu stoi dlugosc — kazda pozycja ja ma.
    markery, oczekiwany, od = [], 1, 0
    while True:
        m = re.compile(rf"\b{oczekiwany}\.\s").search(fragment, od)
        if not m:
            m = re.compile(rf"\b{oczekiwany}\s+(?=[^\s])").search(fragment, od)
            if not m or not DLUGOSC.search(fragment[m.end(): m.end() + 120]):
                break
        markery.append((oczekiwany, m.end()))
        od = m.end()
        oczekiwany += 1
    wynik = []
    for i, (lp, start) in enumerate(markery):
        koniec = (
            markery[i + 1][1] - len(f"{lp + 1}. ")
            if i + 1 < len(markery)
            else len(fragment)
        )
        tresc = fragment[start:koniec].strip()
        d = DLUGOSC.search(tresc)
        if not d:
            wynik.append({"lp": lp, "nazwa_surowa": tresc, "dlugosc_km": None,
                          "opis": None, "watpliwa": True})
            continue
        nazwa = tresc[: d.start()].strip(" .-–—,")
        poz = {"lp": lp, "nazwa_surowa": nazwa,
               "dlugosc_km": float(d.group(1).replace(",", ".")),
               "opis": tresc[d.end():].strip(" .-–—,") or None,
               # pusta nazwa to dziura w samym PDF-ie, nie blad odczytu
               "watpliwa": not nazwa}
        poz.update(rozbij_nazwe(nazwa, miejscowosc))
        wynik.append(poz)
    return wynik


def pozycje_z_paragrafu(t: str) -> list:
    """Uklad B: lista dróg wprost w § 1."""
    i = t.find("§ 1.")
    if i < 0:
        return []
    fragment = t[i: t.find("§ 2.") if t.find("§ 2.") > i else len(t)]
    wynik = []
    for m in re.finditer(
        r"(\d{1,2})\)\s*drog[ai]\s+w\s+miejscowo[śs]ci\s+([\w\-ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+)"
        r"(?:\s*[-–—]\s*ul\.\s*([^,;]+?))?\s*o\s+d[łl]ugo[śs]ci\s+(\d+,\d+)\s*km"
        r"\s*[-–—]\s*(?:odcinek\s*)?([^;]+)",
        fragment,
    ):
        wynik.append({
            "lp": int(m.group(1)),
            "nazwa_surowa": " ".join(m.group(0).split())[:120],
            "miejscowosc": m.group(2).strip(),
            "ulica": (m.group(3) or "").strip() or None,
            "numer_drogi": None,
            "typ": "ulica" if m.group(3) else "bez_nazwy",
            "dlugosc_km": float(m.group(4).replace(",", ".")),
            "opis": " ".join(m.group(5).split()).rstrip(". "),
            "watpliwa": False,
        })
    return wynik


def zalaczniki(t: str) -> list:
    czesci = re.split(r"Za[łl][ąa]cznik\s+(?:Nr\s+)?(\d)?", t)
    out, nr_domyslny = [], 0
    for i in range(1, len(czesci), 2):
        nr_domyslny += 1
        nr = int(czesci[i]) if czesci[i] else nr_domyslny
        tresc = czesci[i + 1]
        m = KONIEC_NAGLOWKA.search(tresc)
        if not m:
            continue  # załącznik graficzny — mapa, nie tabela
        podpis = " ".join(tresc[: m.start()].split())
        poza = "poza granicami miasta" in podpis
        out.append({
            "zalacznik": nr,
            "podpis": podpis[-90:],
            "poza_miastem": poza,
            "pozycje": pozycje_tabeli(tresc[m.end():], None if poza else "Wyszków"),
        })
    return out


def main(sciezki):
    akty = []
    for s in sciezki:
        p = Path(s)
        t = tekst(p)
        akt = naglowek_aktu(t)
        akt["plik"] = p.name
        akt["zalaczniki"] = zalaczniki(t)
        if not any(z["pozycje"] for z in akt["zalaczniki"]):
            poz = pozycje_z_paragrafu(t)
            if poz:
                akt["zalaczniki"] = [{"zalacznik": 0, "podpis": "wykaz w § 1 uchwały",
                                      "poza_miastem": None, "pozycje": poz}]
        akty.append(akt)
        wszystkie = [x for z in akt["zalaczniki"] for x in z["pozycje"]]
        km = sum(x["dlugosc_km"] or 0 for x in wszystkie)
        print(
            f"{p.name}: {akt.get('numer','?')} z {akt.get('data_podjecia','?')} — "
            f"tabel {len(akt['zalaczniki'])}, pozycji {len(wszystkie)} ({km:.1f} km), "
            f"wątpliwych {sum(x['watpliwa'] for x in wszystkie)}",
            file=sys.stderr,
        )
    print(json.dumps({"akty": akty}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main(sys.argv[1:])
