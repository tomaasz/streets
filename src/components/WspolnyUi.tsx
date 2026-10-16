/*
 * Wspólny UI — komponenty dla Next.js (App Router). Plik kopiowany do src/components/.
 * Komponenty serwerowe bez stanu; zachowanie (motyw, menu, dialogi) zapewnia ui.js.
 *
 * Root layout:
 *   import Script from 'next/script';
 *   <html lang="pl" suppressHydrationWarning>          // ui.js ustawia data-ui-theme przed hydracją
 *     <head><link rel="stylesheet" href="/wspolny_ui/ui.css" /></head>
 *     <body className="ui-body" data-ui-access="public">
 *       <Script src="/wspolny_ui/ui.js" strategy="beforeInteractive" />
 *       <UiAppBar … /> <UiTabs … /> <main className="ui-main" id="tresc" tabIndex={-1}>…</main> <UiFooter … />
 *
 * Pliki dist/ trafiają do public/wspolny_ui/.
 */
import React from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { UiHelpInit } from './UiHelpInit';

export type UiAccess = 'public' | 'user' | 'admin';
export type UiApp = { name: string; short: string; url: string; admin?: boolean };
export type UiTab = { label: string; url: string; current?: boolean; admin?: boolean };
export type UiLink = { label: string; url: string };
export type UiUser = { name: string; email?: string; initials: string };

const ORG = 'Urząd Miejski w Wyszkowie';

function IkonaDostepu({ level }: { level: UiAccess }) {
  const wspolne = { 'aria-hidden': true, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4 } as const;
  if (level === 'public') {
    return <svg {...wspolne}><circle cx="8" cy="8" r="6.3" /><path d="M1.7 8h12.6M8 1.7c2 2 2 10.6 0 12.6M8 1.7c-2 2-2 10.6 0 12.6" /></svg>;
  }
  if (level === 'admin') {
    return <svg {...wspolne} strokeLinejoin="round"><path d="M8 1.6 13 3.5v4.2c0 3.1-2.1 5.6-5 6.7-2.9-1.1-5-3.6-5-6.7V3.5z" /></svg>;
  }
  return <svg {...wspolne}><circle cx="8" cy="5.3" r="2.8" /><path d="M2.5 14.3c.7-3 2.9-4.5 5.5-4.5s4.8 1.5 5.5 4.5" /></svg>;
}

const POZIOMY: Record<UiAccess, { klasa: string; tekst: string }> = {
  public: { klasa: 'ui-access ui-access-public', tekst: 'Publiczny' },
  user: { klasa: 'ui-access', tekst: 'Dla zalogowanych' },
  admin: { klasa: 'ui-access ui-access-admin', tekst: 'Administrator' },
};

export function UiAccessBadge({ level }: { level: UiAccess }) {
  const p = POZIOMY[level];
  return <span className={p.klasa}><IkonaDostepu level={level} />{p.tekst}</span>;
}

export function UiPageHeading({ title, level, lede }: { title: string; level: UiAccess; lede?: string }) {
  return (
    <div className="ui-page-heading">
      <div>
        <div className="ui-title-row">
          <h1>{title}</h1>
          <UiAccessBadge level={level} />
        </div>
        {lede && <p className="ui-lede">{lede}</p>}
      </div>
    </div>
  );
}

export function UiAppBar({
  appName, homeUrl = '/', crestUrl = '/wspolny_ui/herb_wyszkowa.png', apps = [], user, loginUrl, logoutUrl, accountUrl, actions,
}: {
  appName: string; homeUrl?: string; crestUrl?: string; apps?: UiApp[]; user?: UiUser;
  loginUrl?: string; logoutUrl?: string; accountUrl?: string;
  /** akcje aplikacji w pasku, przed launcherem (np. <button className="ui-bar-button">) */
  actions?: React.ReactNode;
}) {
  return (
    <>
      <a className="ui-skip-link" href="#tresc">Przejdź do treści</a>
      <header className="ui-appbar">
        <Link className="ui-brand" href={homeUrl as Route} aria-label={`${appName} — ${ORG}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- mały lokalny plik, bez optymalizacji */}
          <img className="ui-crest" src={crestUrl} alt="" width={28} height={36} />
          <span className="ui-brand-copy">
            <span className="ui-app-name">{appName}</span>
            <span className="ui-org-name">{ORG}</span>
          </span>
        </Link>
        <div className="ui-spacer" />
        {actions && <div className="ui-bar-actions">{actions}</div>}
        {apps.length > 0 && (
          <details className="ui-dropdown ui-launcher">
            <summary aria-label="Aplikacje" title="Aplikacje">
              <svg aria-hidden width="17" height="17" viewBox="0 0 20 20" fill="currentColor">
                {[4, 10, 16].flatMap((y) => [4, 10, 16].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" />))}
              </svg>
            </summary>
            <nav className="ui-dropdown-menu" aria-label="Aplikacje organizacji">
              {apps.map((a) => (
                <a key={a.url} href={a.url} aria-current={a.name === appName ? 'page' : undefined}>
                  <span className="ui-launcher-icon">{a.short}</span>{a.name}
                  {a.admin && <span className="ui-menu-admin">admin</span>}
                </a>
              ))}
            </nav>
          </details>
        )}
        <button className="ui-icon-button" type="button" data-ui-theme-toggle title="Zmień motyw" suppressHydrationWarning>
          <svg aria-hidden width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <circle cx="10" cy="10" r="3.2" />
            <path d="M10 1.8v1.5m0 13.4v1.5M1.8 10h1.5m13.4 0h1.5M4.2 4.2l1.1 1.1m9.4 9.4 1.1 1.1m0-11.6-1.1 1.1m-9.4 9.4-1.1 1.1" />
          </svg>
        </button>
        {user ? (
          <details className="ui-dropdown ui-user">
            <summary aria-label={`Konto: ${user.name}`} title="Konto">
              <span className="ui-avatar" aria-hidden>{user.initials}</span>
              <span className="ui-user-name">{user.name}</span>
            </summary>
            <div className="ui-dropdown-menu">
              <div className="ui-menu-header"><strong>{user.name}</strong>{user.email && <small>{user.email}</small>}</div>
              {accountUrl && <a href={accountUrl}>Moje konto</a>}
              {logoutUrl && <form action={logoutUrl} method="post"><button type="submit">Wyloguj</button></form>}
            </div>
          </details>
        ) : loginUrl ? (
          <a className="ui-login" href={loginUrl}>Zaloguj</a>
        ) : null}
      </header>
    </>
  );
}

export function UiTabs({ items, label = 'Nawigacja aplikacji' }: { items: UiTab[]; label?: string }) {
  return (
    <nav className="ui-nav" aria-label={label}>
      <div className="ui-tabs">
        {items.map((t) => (
          <Link key={t.url} href={t.url as Route} className={t.admin ? 'ui-tab-admin' : undefined} aria-current={t.current ? 'page' : undefined}>
            {t.admin && <IkonaDostepu level="admin" />}{t.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

/** Stopka: z lewej aplikacja, urząd, krótki stan (extra) i wersja; z prawej linki (Pomoc i Licencje są wymagane). */
export function UiFooter({ appName, links, extra, version }: {
  appName: string; links: UiLink[]; extra?: React.ReactNode; version?: string;
}) {
  return (
    <footer className="ui-footer">
      <div className="ui-footer-info">
        <span>{appName}</span><span aria-hidden>·</span><span>{ORG}</span>
        {extra && <><span aria-hidden>·</span>{extra}</>}
        {version && <><span aria-hidden>·</span><span>wersja {version}</span></>}
      </div>
      <nav className="ui-footer-links" aria-label="Linki w stopce">
        {links.map((l, i) => (
          <span key={l.url} style={{ display: 'contents' }}>
            {i > 0 && <span aria-hidden>·</span>}<a href={l.url}>{l.label}</a>
          </span>
        ))}
      </nav>
    </footer>
  );
}

export type UiComponentIcon = 'grid' | 'file' | 'chart' | 'plus' | 'export' | 'filter' | 'chevron';
const COMPONENT_PATHS: Record<UiComponentIcon, string> = {'grid': 'M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z', 'file': 'M4 2h6l3 3v9H4zM10 2v3h3', 'chart': 'M3 13V8m4 5V4m4 9V7M2 14h12', 'plus': 'M8 3v10M3 8h10', 'export': 'M8 2v8m-3-3 3 3 3-3M3 14h10', 'filter': 'M2 3h12L10 8v4l-4 2V8z', 'chevron': 'M10 3.5 5.5 8l4.5 4.5'};

function ComponentIcon({ name = 'file' }: { name?: UiComponentIcon }) {
  return <svg aria-hidden viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d={COMPONENT_PATHS[name] || COMPONENT_PATHS.file} /></svg>;
}

export type UiSidenavGroup = { label: string; links: { label: string; url: string; icon?: UiComponentIcon; current?: boolean; count?: string | number }[] };
export type UiSidenavProps = { groups: UiSidenavGroup[]; label?: string; collapsible?: boolean };

export function UiSidenav({ groups, label = 'Nawigacja widoków', collapsible = true }: UiSidenavProps) {
  return <nav className="ui-sidenav" aria-label={label}>
    {groups.map((group, i) => <React.Fragment key={i}>
      <p className="ui-sidenav-label">{group.label}</p>
      {group.links.map((link) => <Link key={link.url} href={link.url as Route} title={link.label} aria-current={link.current ? 'page' : undefined}>
        <ComponentIcon name={link.icon} />{link.label}{link.count != null && <span className="ui-sidenav-count">{link.count}</span>}
      </Link>)}
    </React.Fragment>)}
    {collapsible && <button className="ui-sidenav-toggle" type="button" data-ui-sidenav-toggle aria-expanded="true" aria-label="Zwiń panel boczny"><ComponentIcon name="chevron" /></button>}
  </nav>;
}

/** children: główna treść, zwykle <main className="ui-main" id="tresc" tabIndex={-1}>. */
export function UiWorkspace({ id, children, ...sidenav }: UiSidenavProps & { id?: string; children: React.ReactNode }) {
  return <div className="ui-workspace" id={id}><UiSidenav {...sidenav} />{children}</div>;
}

export type UiKpiItem = {
  label: string; value: string | number; unit?: string; kind?: 'success' | 'warning' | 'info' | 'neutral';
  url?: string; meta?: string; delta?: string | number; direction?: 'up' | 'down';
};
export function UiKpi({ item }: { item: UiKpiItem }) {
  const className = `ui-kpi${item.kind ? ` ui-kpi-${item.kind}` : ''}`;
  const content = <>
    <span className="ui-kpi-label">{item.label}</span>
    <span className="ui-kpi-value">{item.value}{item.unit && <span className="ui-kpi-unit">{item.unit}</span>}</span>
    {(item.meta || item.delta != null) && <span className="ui-kpi-meta">
      {item.delta != null && <><span className={`ui-delta${item.direction ? ` ui-delta-${item.direction}` : ''}`}>
        {item.direction && <span className="ui-visually-hidden">{item.direction === 'up' ? 'wzrost ' : 'spadek '}</span>}{item.delta}
      </span>{' '}</>}{item.meta}
    </span>}
  </>;
  return item.url ? <Link className={className} href={item.url as Route}>{content}</Link> : <div className={className}>{content}</div>;
}
export function UiKpis({ items }: { items: UiKpiItem[] }) {
  return <div className="ui-kpis">{items.map((item, i) => <UiKpi key={i} item={item} />)}</div>;
}

export type UiTool = { label: string; icon?: UiComponentIcon } & (
  { url: string; type?: never; name?: never; value?: never; pressed?: never; disabled?: never } |
  { url?: never; type?: 'button' | 'submit' | 'reset'; name?: string; value?: string | number; pressed?: boolean; disabled?: boolean }
);
/** Stan i obsługę poleceń zapewnia aplikacja; children pozwala dodać pola lub własne komponenty. */
export function UiToolbar({ groups, label = 'Polecenia', sticky = false, children }: {
  groups: UiTool[][]; label?: string; sticky?: boolean; children?: React.ReactNode;
}) {
  return <div className={`ui-toolbar${sticky ? ' ui-sticky' : ''}`} role="toolbar" aria-label={label}>
    {groups.map((group, i) => <React.Fragment key={i}>
      {i > 0 && <span className="ui-toolbar-sep" aria-hidden />}
      <div className="ui-toolbar-group">{group.map((tool, j) => {
        const content = <>{tool.icon && <ComponentIcon name={tool.icon} />}{tool.label}</>;
        return tool.url != null ? <Link key={j} className="ui-tool" href={tool.url as Route}>{content}</Link> :
          <button key={j} className="ui-tool" type={tool.type || 'button'} name={tool.name} value={tool.value} aria-pressed={tool.pressed} disabled={tool.disabled}>{content}</button>;
      })}</div>
    </React.Fragment>)}
    {children && <><div className="ui-spacer" />{children}</>}
  </div>;
}

/** Centrum pomocy; children: section.ui-help-section z id oraz h2. */
export function UiHelp({ children }: { children: React.ReactNode }) {
  return (
    <div className="ui-help" data-ui-help="" data-ui-help-defer="">
      <UiHelpInit />
      <aside className="ui-help-sidebar" aria-label="Nawigacja pomocy">
        <div className="ui-help-search">
          <label className="ui-label">
            <span>Szukaj w pomocy</span>
            <input className="ui-input" type="search" data-ui-help-search="" placeholder="Wpisz temat lub pytanie" autoComplete="off" />
          </label>
          <div className="ui-help-search-actions">
            <span className="ui-hint" data-ui-help-count="" role="status" aria-live="polite" aria-atomic="true" />
            <button className="ui-button ui-button-subtle" type="button" data-ui-help-clear="" hidden>Wyczyść</button>
          </div>
        </div>
        <p className="ui-help-label">Spis treści</p>
        <nav className="ui-help-nav" aria-label="Tematy pomocy" data-ui-help-nav="" />
      </aside>
      <div className="ui-help-content">
        <div className="ui-empty" data-ui-help-empty="" hidden>
          <strong>Nie znaleziono pasujących tematów</strong>
          <p>Spróbuj użyć innego słowa lub pokaż wszystkie tematy.</p>
          <button className="ui-button" type="button" data-ui-help-clear="">Pokaż wszystkie tematy</button>
        </div>
        {children}
      </div>
    </div>
  );
}
