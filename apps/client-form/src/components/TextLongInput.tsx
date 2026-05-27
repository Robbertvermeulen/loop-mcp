interface TextLongInputProps {
  prompt: string;
  value: string;
  placeholder?: string;
  autofocus?: boolean;
  onChange: (v: string) => void;
}

export default function TextLongInput(props: TextLongInputProps) {
  return (
    <div>
      <label class="block">
        <span>{props.prompt}</span>
        <textarea
          class="w-full"
          rows={5}
          value={props.value}
          placeholder={props.placeholder}
          autofocus={props.autofocus}
          onInput={(e) => props.onChange(e.currentTarget.value)}
        />
      </label>
    </div>
  );
}
