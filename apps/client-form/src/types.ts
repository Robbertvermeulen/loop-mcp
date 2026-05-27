export type QuestionType = 'text_short' | 'text_long' | 'single_choice' | 'multi_choice';

export type Question =
  | { id: string; type: 'text_short'; prompt: string; required?: boolean; placeholder?: string }
  | { id: string; type: 'text_long'; prompt: string; required?: boolean; placeholder?: string }
  | {
      id: string;
      type: 'single_choice';
      prompt: string;
      required?: boolean;
      options: string[];
      allowOther?: boolean;
    }
  | {
      id: string;
      type: 'multi_choice';
      prompt: string;
      required?: boolean;
      options: string[];
      minSelections?: number;
      maxSelections?: number;
    };

export type SingleChoiceAnswer = { value: string; other?: string };
export type MultiChoiceAnswer = { values: string[] };
export type Answer = string | SingleChoiceAnswer | MultiChoiceAnswer;

export type Answers = Record<string, Answer>;

export type RequestStatus = 'pending' | 'submitted' | 'pulled' | 'cancelled';

export interface PublicView {
  displayName: string;
  projectName?: string;
  title: string;
  intro?: string;
  questions: Question[];
  draftAnswers?: Answers;
  status: 'pending' | 'submitted';
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
