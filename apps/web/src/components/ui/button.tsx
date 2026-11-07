import type { ComponentProps } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
const buttonVariants = cva("button", {
  variants: {
    variant: {
      default: "button-brand",
      outline: "button-outline",
      ghost: "button-ghost",
      destructive: "button-danger",
    },
  },
  defaultVariants: { variant: "default" },
});
export function Button({
  className,
  variant,
  asChild = false,
  busy = false,
  disabled,
  children,
  ...props
}: ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean; busy?: boolean }) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      className={cn(buttonVariants({ variant }), className)}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...props}
    >
      {busy ? (
        <>
          <span className="invisible">{children}</span>
          <LoaderCircle aria-hidden="true" className="button-spinner" />
        </>
      ) : (
        children
      )}
    </Component>
  );
}
