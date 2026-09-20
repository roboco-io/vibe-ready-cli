import { readFileSync, realpathSync, statSync, existsSync } from "node:fs";
import { resolve, relative, isAbsolute, sep } from "node:path";
import type { Profile } from "./types.js";

export const RUBRIC_VERSION = "process-1";
export const PROFILES: Profile[] = ["service", "library", "cli", "data", "general"];
export interface DiagnosisCheck { id: string; title: string; question: string; }
const COMMON: DiagnosisCheck[] = [
  { id: "acceptance", title: "요구사항과 완료 조건", question: "중요 사용자 동작의 기대 결과와 실패 조건이 명확하고 구현·테스트·리뷰가 이를 공유하는가? 특정 문서 형식이나 이슈 트래커를 요구하지 않는다." },
  { id: "reproducibility", title: "재현 가능한 개발 환경", question: "새 작업자가 안내에 따라 필요한 런타임·의존성·환경을 준비하고 동일한 검증을 재현할 수 있는가? Docker 등 특정 도구는 필수가 아니다." },
  { id: "verification", title: "행동과 회귀 검증", question: "핵심 사용자 시나리오·경계/실패 조건·반복 결함을 테스트가 실제로 검증하는가? 소스와 테스트 표본을 대조한다. 파일 수·커버리지 임계값만으로 충족 판정하지 않는다." },
  { id: "feedback", title: "검증 피드백과 변경 차단", question: "필요한 검증이 변경 흐름에서 자동 실행되고 실패를 차단하는가? CI·로컬 훅의 적용 시점과 범위를 구분하고 동일 검증을 중복 보상하지 않는다. 훅 부재만으로 미흡 판정하지 않는다. 재실행은 불안정 테스트의 증명이 아니다." },
  { id: "changeability", title: "변경 용이성과 작업 맥락", question: "책임 경계와 변경 위치·영향을 파악할 수 있고 실제 코드와 작업 안내가 일치하는가? AI에게 완료 조건과 권한 경계가 전달되는가? 스킬·MCP·다중 에이전트 설치는 만점 조건이 아니다." },
  { id: "traceability", title: "리뷰와 변경 의도", question: "변경 이유·요구사항·검증 결과를 추적할 수 있고 리뷰의 반복 수정·대기를 설명할 근거가 있는가? 이슈 번호 비율이나 PR 개수만으로 평가하지 않는다." },
];
const DELIVERY: Record<Profile, string> = {
  service: "변경 배포, 오류 진단, 복구 및 데이터 마이그레이션의 안전성을 확인할 근거가 있는가? 배포·장애 이력이 없으면 실제 운영 성과는 미확인으로 남긴다.",
  library: "공개 API의 호환성·패키지 설치·지원 런타임과 릴리스 검증을 확인할 수 있는가? 서버 배포·운영 알림을 요구하지 않는다.",
  cli: "사용자 설치·주요 명령·종료 코드·오류 메시지·기존 옵션 호환성과 릴리스 검증을 확인할 수 있는가? 서버 운영 요건을 강제하지 않는다.",
  data: "입력/스키마 검증·재실행 안전성·부분 실패 복구·데이터 및 결과 재현성을 확인할 수 있는가? 웹 서비스 요건을 강제하지 않는다.",
  general: "이 저장소의 실제 사용·전달 방식에서 실패 진단과 안전한 재시도/복구가 가능한가? 유형을 추측하여 불필요한 배포 도구를 요구하지 않는다.",
};
export function getChecks(profile: Profile): DiagnosisCheck[] {
  return [...COMMON, { id: "delivery", title: "전달·진단·복구", question: DELIVERY[profile] }];
}

export function readRepositoryFile(repoPath: string, file: string): string {
  const root = realpathSync(repoPath);
  const target = realpathSync(resolve(root, file));
  const rel = relative(root, target);
  if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error("저장소 밖의 파일은 읽을 수 없습니다");
  if (rel.split(sep).some(part => part === ".git" || part === "node_modules" || part === ".omc" || part === ".omx" || /^\.env(?:\.|$)/.test(part) && !/\.example$/.test(part))) {
    throw new Error("진단 근거로 읽을 수 없는 파일입니다");
  }
  const stat = statSync(target);
  if (!stat.isFile() || stat.size > 1_000_000) throw new Error("근거 파일은 1MB 이하의 일반 파일이어야 합니다");
  return readFileSync(target, "utf8");
}
export function detectProfile(repoPath: string): Profile {
  try {
    const pkg = JSON.parse(readRepositoryFile(repoPath, "package.json"));
    if (pkg.bin) return "cli";
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (["next", "express", "fastify", "@nestjs/core", "nuxt"].some(name => name in deps)) return "service";
    if (pkg.exports || (pkg.main && !pkg.private)) return "library";
  } catch { /* Absence or invalid manifests are not evidence of a profile. */ }
  if (existsSync(resolve(repoPath, "dbt_project.yml"))) return "data";
  return "general";
}
