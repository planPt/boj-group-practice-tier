# BOJ Group Practice Tier Display

백준 **그룹 연습**의 문제 목록과 스코어보드에 solved.ac 난이도와 레이팅 상태를 표시하는 Tampermonkey 스크립트입니다. BOJ·solved.ac의 공식 프로그램은 아닙니다.

**[Greasy Fork 설치 페이지](https://greasyfork.org/ko/scripts/606581-boj-group-practice-tier-display)** · [GitHub 직접 설치](https://raw.githubusercontent.com/planPt/boj-group-practice-tier/main/boj-group-practice-tier.user.js) · [설치·키 발급 상세 안내](INSTALL.ko.txt) · [오류 제보](https://github.com/planPt/boj-group-practice-tier/issues)

## 빠른 설치

1. [Tampermonkey](https://www.tampermonkey.net/)를 설치합니다. Chrome 확장 프로그램 관리 → Tampermonkey → 세부정보에서 **사용자 스크립트 허용**을 켭니다.
2. 위 **Greasy Fork 설치 페이지**에서 설치 버튼을 누릅니다. GitHub 직접 설치도 가능합니다. 코드만 보이면 Tampermonkey 대시보드 → 유틸리티의 **URL 가져오기**에 같은 링크를 입력합니다. 또는 새 스크립트에 코드 전체를 붙여넣고 저장합니다.
3. [solved.ac Backstage](https://backstage.solved.ac/developer/apps)에서 **본인의 앱**을 만들고, 약관을 확인한 뒤 **Client ID와 Secret**을 발급받습니다. Secret은 최초 발급 시 한 번만 표시됩니다.
4. 백준 **그룹 연습 보기** 페이지를 새로고침하고 **API 키 설정**을 누릅니다. 또는 해당 백준 탭에서 Tampermonkey 메뉴의 **solved.ac API 키 설정**을 선택합니다.
5. 본인의 Client ID와 Secret을 차례로 입력합니다. 팀 초대와 OAuth2 설정은 필요하지 않습니다.

키 설정 메뉴는 스크립트 편집기가 아니라 **백준 그룹 연습 탭**에서 확인하세요. 메뉴와 페이지 안내가 모두 없으면 스크립트 활성화, 사용자 스크립트 허용, 백준 사이트 접근 권한, 저장 여부를 확인합니다.

지원 주소:

```text
https://acmicpc.net/group/practice/view/*
https://www.acmicpc.net/group/practice/view/*
```

## 표시하는 상태

| 표시 | 의미 |
| --- | --- |
| 레이팅 | 난이도가 있고 레이팅 반영 대상 |
| 보류 | 기여 부족으로 레이팅 보류 |
| 제외 | 다른 사유로 레이팅 제외 |
| 제외·보류 | 기여 부족과 별도 제외 사유가 함께 존재 |
| 미정 | 아직 난이도가 정해지지 않음 |
| 조회 오류 / 인증 확인 | 요청 실패이며 문제의 레이팅 상태와 별개 |

아이콘에 마우스를 올리거나 키보드로 초점을 옮기면 푼 사람, 전체·유효 기여 수, 제외 사유를 볼 수 있습니다. 상태는 solved.ac v4 응답을 사용하며 기여자 수만으로 임의 판정하지 않습니다. BOJ 번호는 응답의 `judgeIds`와 대조합니다.

## 배포와 자동 업데이트

공유할 때는 [Greasy Fork 페이지](https://greasyfork.org/ko/scripts/606581-boj-group-practice-tier-display)를 보내세요. 설치 방법과 개인 API 키 발급 안내가 포함되어 있습니다.

- GitHub에서 설치한 버전은 GitHub의 업데이트 주소를 사용합니다.
- Greasy Fork에서 설치한 버전은 Greasy Fork에서 업데이트를 받습니다. Greasy Fork는 이 저장소의 `main` 코드와 `GREASYFORK.ko.txt` 설명을 자동 동기화하도록 설정되어 있습니다.
- 동기화와 사용자 스크립트 관리자의 확인 주기에 따라 반영 지연이 있을 수 있습니다. 기존 GitHub 설치본을 다시 설치할 필요는 없습니다.

## 기존 수동 설치판에서 갱신

`2026.11.21.1` 등 이전 파일로 설치했다면, **기존 스크립트 항목**의 코드를 이 저장소의 최신 `.user.js` 내용으로 한 번 교체하고 저장하세요. 새 항목을 중복 생성하지 마세요.

웹 배포판부터 `@updateURL`·`@downloadURL`이 포함됩니다. 이후 Tampermonkey가 사용자의 업데이트 설정에 따른 주기로 새 버전을 확인합니다. 즉시 업데이트를 보장하지 않으며, 새 권한이 필요한 변경은 추가 확인이 필요할 수 있습니다. 같은 스크립트 항목으로 갱신할 때 저장된 키는 유지됩니다.

## 키와 요청량

- 이 저장소에는 배포자의 **실제 Client ID·Secret이 없습니다**. 각자 발급한 키를 사용합니다.
- 입력한 키는 코드·페이지 DOM·localStorage에 넣지 않고 **Tampermonkey 스크립트 전용 저장소**에 보관합니다. 요청에는 solved.ac의 고정 HTTPS API 주소만 사용하며 쿠키를 보내지 않고 리다이렉트를 거부합니다. 아이콘은 `cdn.solved.ac`에서 불러옵니다.
- 이것은 개인 브라우저에서 사용하는 구성입니다. solved.ac의 키 발급 화면은 서버 보관을 안내하며, 브라우저 저장은 서버 보관과 동일한 보안 수준이 아닙니다. 하나의 Secret을 다른 사용자에게 배포하지 마세요.
- **저장소를 포함한 Tampermonkey 백업은 공유하지 마세요.** `Include script storage`를 켠 내보내기에 입력한 키가 포함될 수 있습니다. 코드나 설치 링크만 공유하세요.
- 문제는 5개씩 묶어 조회하고 요청 간격은 최소 1.6초입니다. 10문제는 캐시가 없을 때 보통 2회 검색 요청입니다.
- 성공한 공개 문제 정보는 Tampermonkey 저장소에 최대 300문제·24시간 보관합니다. 5분 이내 결과는 새로고침·재방문에도 추가 요청 없이 재사용합니다.
- 5분이 지난 결과는 기존 티어와 `갱신 중` 표시를 유지하며 다시 조회합니다. 실패하면 `갱신 실패`를 표시하고 기존 정보를 유지합니다. 툴팁에서 마지막 조회 시각과 오류를 확인할 수 있으며, 24시간이 지난 값은 표시하지 않습니다.
- `실패한 문제만 재시도`는 성공한 문제를 다시 조회하지 않습니다. 모든 문제를 다시 확인하려면 별도 `전체 문제 정보 새로고침` 메뉴를 사용하세요. 키를 교체하거나 지우면 문제 캐시도 초기화합니다.
- 저장소는 같은 브라우저·같은 스크립트 항목에서 재사용하지만, **여러 탭의 동시 요청을 합치거나 요청 간격을 조정하지는 않습니다.** 같은 키를 쓰는 여러 탭·기기는 앱 호출 한도를 공유합니다. HTTP 429 대기 중에는 재시도·전체 새로고침도 서버 대기 시간을 지킵니다.
- 키 유출이 의심되면 Backstage에서 해당 키를 폐기하세요. 메뉴의 **저장한 solved.ac API 키 지우기**는 브라우저 저장값만 삭제하며 서버의 키를 폐기하지 않습니다.

## 확인 범위

실제 BOJ 그룹 연습 DOM과 solved.ac v4 응답을 대조한 초기 16개 검사에 지속 캐시·갱신 실패·실패 항목만 재시도·키 변경·429 대기 등의 회귀 검사를 추가해 31개 검사를 통과했습니다. 독립 검수에서 확인한 최신 성공 복원 후 실패 상태 잔존 문제를 수정하고 재검수를 통과했습니다. `npm ci && npm test`로 실행할 수 있습니다. 테스트 데이터는 공개 문제 정보 중 표시에 필요한 필드만 포함합니다.

`2026.11.21.5`부터 재방문 캐시, 기존 표시를 유지하는 갱신, 실패 항목만 재시도를 지원합니다. Chrome 모의 응답 화면의 페이지 이동·뒤로가기·새로고침 검증은 실제 Tampermonkey 설치본의 종단 검증과 구분합니다.

사용자의 기존 GitHub 설치본에서 업데이트 확인으로 `2026.11.21.2` → `2026.11.21.3` 갱신도 확인했습니다. 예약된 자동 확인 시점 및 모든 사용자 환경에서의 갱신 완료를 보장하는 것은 아닙니다. 오류 제보에는 문제 번호와 오류 문구만 첨부하고 비밀키를 포함하지 마세요.

## 참고

- [solved.ac API 문서](https://backstage.solved.ac/developer/docs)
- [solved.ac 기여·레이팅 기준](https://solved.ac/ko/guideline)
- [solved.ac 개발자 약관](https://solved.ac/developer-terms)
- [Tampermonkey 사용자 스크립트 허용](https://www.tampermonkey.net/faq.php?locale=en&q=Q209)
- [Tampermonkey 업데이트 메타데이터](https://www.tampermonkey.net/documentation.php?locale=en&q=update_url)
- [배포 관리 안내](MAINTAINING.md)

## 라이선스

이 저장소의 스크립트와 문서는 [MIT License](LICENSE)로 배포합니다. Copyright (c) 2024-2026 planPt. 수정·재배포할 때 저작권과 라이선스 고지를 유지하세요. solved.ac 등 외부 서비스의 데이터·아이콘과 이용 약관은 해당 권리자 및 서비스의 조건을 따릅니다.
