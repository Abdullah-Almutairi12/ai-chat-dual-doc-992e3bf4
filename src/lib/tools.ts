import {
  MessageSquareText,
  Sheet,
  SpellCheck,
  FileType2,
  GraduationCap,
  ChartColumnBig,
  type LucideIcon,
} from "lucide-react";

import type { TranslationKey } from "./translations";

export type Tool = {
  id: string;
  path: string;
  icon: LucideIcon;
  titleKey: TranslationKey;
  descKey: TranslationKey;
};

export const tools: Tool[] = [
  {
    id: "chat",
    path: "/chat",
    icon: MessageSquareText,
    titleKey: "tool_chat",
    descKey: "tool_chat_desc",
  },
  {
    id: "tables",
    path: "/tables",
    icon: Sheet,
    titleKey: "tool_tables",
    descKey: "tool_tables_desc",
  },
  {
    id: "proofreader",
    path: "/proofreader",
    icon: SpellCheck,
    titleKey: "tool_proofreader",
    descKey: "tool_proofreader_desc",
  },
  {
    id: "converter",
    path: "/converter",
    icon: FileType2,
    titleKey: "tool_converter",
    descKey: "tool_converter_desc",
  },
  {
    id: "quiz",
    path: "/quiz",
    icon: GraduationCap,
    titleKey: "tool_quiz",
    descKey: "tool_quiz_desc",
  },
  {
    id: "analyzer",
    path: "/analyzer",
    icon: ChartColumnBig,
    titleKey: "tool_analyzer",
    descKey: "tool_analyzer_desc",
  },
];