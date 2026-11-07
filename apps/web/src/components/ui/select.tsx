import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import type { CityOption } from "@/lib/city";
export function AccessibleSelect({
  value,
  options,
  onValueChange,
  label,
}: {
  value: string;
  options: readonly CityOption[];
  onValueChange: (value: string) => void;
  label: string;
}) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger className="select-trigger" aria-label={label}>
        <SelectPrimitive.Value />
        <SelectPrimitive.Icon>
          <ChevronDown size={20} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="select-content"
          position="popper"
          sideOffset={8}
          collisionPadding={16}
        >
          <SelectPrimitive.ScrollUpButton className="select-scroll">
            <ChevronUp size={16} />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport>
            {options.map((option) => (
              <SelectPrimitive.Item
                className="select-item"
                value={option.slug}
                key={option.slug}
              >
                <SelectPrimitive.ItemText>
                  {option.name}
                </SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator>
                  <Check size={16} />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="select-scroll">
            <ChevronDown size={16} />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
