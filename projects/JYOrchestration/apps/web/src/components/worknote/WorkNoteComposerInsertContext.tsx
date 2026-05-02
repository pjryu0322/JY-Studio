"use client";

import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from "react";

type InsertHandler = (text: string) => void;

type WorkNoteComposerInsertValue = {
  readonly register: (handler: InsertHandler | null) => void;
  /** 메모에서 선택한 텍스트를 현재 단계의 대화 입력창에 넣습니다. */
  readonly insert: InsertHandler;
};

const WorkNoteComposerInsertContext = createContext<WorkNoteComposerInsertValue | null>(null);

export function WorkNoteComposerInsertProvider({ children }: { readonly children: ReactNode }) {
  const handlerRef = useRef<InsertHandler | null>(null);

  const register = useCallback((handler: InsertHandler | null) => {
    handlerRef.current = handler;
  }, []);

  const insert = useCallback((text: string) => {
    const fn = handlerRef.current;
    if (fn) {
      fn(text);
      return;
    }
    window.alert("이 화면에서는 요구사항 대화 입력창과 연결되어 있지 않습니다. 프로젝트의 요구사항(아이디어 구체화·서비스 흐름) 화면에서 사용해 주세요.");
  }, []);

  const value = useMemo(() => ({ register, insert }), [register, insert]);

  return <WorkNoteComposerInsertContext.Provider value={value}>{children}</WorkNoteComposerInsertContext.Provider>;
}

export function useWorkNoteComposerInsertControls(): WorkNoteComposerInsertValue {
  const ctx = useContext(WorkNoteComposerInsertContext);
  if (!ctx) {
    throw new Error("WorkNoteComposerInsertProvider가 필요합니다.");
  }
  return ctx;
}

/** Provider 밖(예: 다른 앱 라우트)에서는 `undefined`. */
export function useWorkNoteComposerInsertHandler(): InsertHandler | undefined {
  return useContext(WorkNoteComposerInsertContext)?.insert;
}
