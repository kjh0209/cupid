// ============================================================
// Context Signals — blank-slate session detection
//
// "blank slate" = 워크스페이스 파일이 없거나 session history가 없는 상태.
// 이 경우 모델은 zero-context에서 창작해야 하므로 cheap tier로 라우팅하면
// 실망스러운 결과가 나올 가능성이 높다.
// ============================================================

import { sessionContextStore } from "../cpl/sessionContextStore.js";

export interface WorkspaceSignal {
  fileCount: number;
  taskHistoryCount: number;
  isBlankSlate: boolean;
}

/**
 * 주어진 sessionKey에 대해 빈 워크스페이스 여부를 반환한다.
 * sessionKey가 없거나 세션을 찾을 수 없으면 blank slate로 간주한다.
 */
export function getBlankSlateSignal(sessionKey?: string): WorkspaceSignal {
  if (!sessionKey) {
    return { fileCount: 0, taskHistoryCount: 0, isBlankSlate: true };
  }

  try {
    // Count task history entries to gauge session richness
    const history = sessionContextStore.listHistory(sessionKey, 100);
    const taskHistoryCount = history.length;

    // Use task history as a proxy for workspace activity
    // (workspace file count requires the CPL retrieve call)
    const isBlankSlate = taskHistoryCount === 0;

    return { fileCount: 0, taskHistoryCount, isBlankSlate };
  } catch {
    // If we can't determine context, assume blank slate to be conservative
    return { fileCount: 0, taskHistoryCount: 0, isBlankSlate: true };
  }
}

/**
 * 동기 버전: 이미 알고 있는 파일 목록에서 blank slate를 판단한다.
 * eval 시나리오 및 테스트에서 사용.
 */
export function isBlankSlateFromFiles(files: string[]): boolean {
  return files.length <= 1;
}
