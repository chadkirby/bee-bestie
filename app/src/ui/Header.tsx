import { NavLink } from 'react-router-dom';
import logo from '../assets/logo.webp';

export function Header() {
  return (
    <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="mx-auto max-w-4xl px-4 h-20 flex items-center">
        <NavLink to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <img src={logo} alt="Bee Bestie Logo" className="h-20 w-auto" />
          <div className="flex flex-col leading-none">
            <span className="text-xl font-bold text-foreground">BEE BESTIE</span>
            <span className="text-[0.65rem] font-medium text-muted-foreground tracking-wider uppercase">Spelling Bee Companion</span>
          </div>
        </NavLink>
      </div>
    </header>
  );
}
