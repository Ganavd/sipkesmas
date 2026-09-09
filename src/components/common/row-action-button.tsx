import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Props extends ComponentPropsWithoutRef<"button"> {
  label: string;
  destructive?: boolean;
}

/**
 * Tombol aksi baris tabel: ikon kecil + tooltip label.
 * Ganti dropdown "..." dengan deretan tombol ini agar aksi langsung terlihat.
 */
export const RowActionButton = forwardRef<HTMLButtonElement, Props>(
  ({ label, destructive, className, children, ...rest }, ref) => (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            ref={ref}
            type="button"
            variant="ghost"
            size="icon"
            aria-label={label}
            className={cn(
              "h-8 w-8",
              destructive && "text-destructive hover:bg-destructive/10 hover:text-destructive",
              className,
            )}
            {...rest}
          >
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
);
RowActionButton.displayName = "RowActionButton";