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
        <span class="block font-display font-medium text-3xl md:text-4xl leading-snug text-ink mb-6">
          {props.prompt}
        </span>
        <span class="input-underline-wrap">
          <textarea
            class="textarea-editorial"
            rows={5}
            value={props.value}
            placeholder={props.placeholder}
            autofocus={props.autofocus}
            onInput={(e) => props.onChange(e.currentTarget.value)}
          />
        </span>
      </label>
    </div>
  );
}
