import React from 'react'
import { useLocation, Link } from 'wouter';
import { cn } from '@/lib/utils';

export function MobileNavLink({ href, icon: Icon, label, badge }: {href: string, icon: any, label: string, badge?: number})  {
  const [location] = useLocation();
  const isActive = location === href;
  
  return (
    <Link href={href} className={cn(
      "flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors relative",
    isActive ? "text-primary-foreground" : "text-primary-foreground/50 hover:text-primary-foreground/80"
    )}>
      <div className="relative">
        <Icon className="w-5 h-5" strokeWidth={isActive ? 2 : 1.5} />
        {(badge ?? 0 ) > 0 &&  (
          <span className="absolute -top-1 -right-2 flex items-center justify-center w-3.5 h-3.5  text-[8px] font-bold text-background bg-accent rounded-full ">
            {badge}
          </span>
        )}
      </div>
      <span className="text-[10px] font-medium tracking-wide uppercase">{label}</span>
    </Link>
  )
}