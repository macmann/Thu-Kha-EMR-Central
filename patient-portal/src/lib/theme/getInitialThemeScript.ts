const STORAGE_KEY = 'theme';
const COLOR_SCHEME_MEDIA_QUERY = '(prefers-color-scheme: dark)';

export function getInitialThemeScript(): string {
  return `!function(){try{var root=document.documentElement;var stored=null;try{stored=localStorage.getItem('${STORAGE_KEY}');}catch(e){}var mediaMatch=window.matchMedia('${COLOR_SCHEME_MEDIA_QUERY}').matches;var theme=stored==='dark'||stored==='light'?stored:(mediaMatch?'dark':'light');root.classList.remove('light','dark');root.classList.add(theme);root.style.colorScheme=theme;}catch(e){}}();`;
}
