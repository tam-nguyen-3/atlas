import * as Dropdown from "@radix-ui/react-dropdown-menu";
export const DropdownMenu = Dropdown.Root;
export const DropdownMenuTrigger = Dropdown.Trigger;
export const DropdownMenuItem = Dropdown.Item;
export const DropdownMenuSeparator = Dropdown.Separator;
export function DropdownMenuContent({
  children,
  ...props
}: React.ComponentProps<typeof Dropdown.Content>) {
  return (
    <Dropdown.Portal>
      <Dropdown.Content
        className="account-menu insight-menu"
        align="end"
        sideOffset={6}
        collisionPadding={12}
        {...props}
      >
        {children}
      </Dropdown.Content>
    </Dropdown.Portal>
  );
}
