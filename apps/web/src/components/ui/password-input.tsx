import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";

export function PasswordInput(
  props: ComponentProps<"input"> & { visibilityLabel: string },
) {
  const [visible, setVisible] = useState(false);
  const { visibilityLabel, ...inputProps } = props;
  return (
    <div className="password-input">
      <Input {...inputProps} type={visible ? "text" : "password"} />
      <Button
        type="button"
        variant="ghost"
        disabled={props.disabled}
        aria-label={`${visible ? "Hide" : "Show"} ${visibilityLabel}`}
        aria-pressed={visible}
        onClick={() => setVisible((value) => !value)}
      >
        {visible ? (
          <EyeOff size={18} aria-hidden="true" />
        ) : (
          <Eye size={18} aria-hidden="true" />
        )}
      </Button>
    </div>
  );
}
