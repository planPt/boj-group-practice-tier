# BOJ Group Practice Tier Display

백준 **그룹 연습**의 문제 목록과 스코어보드에 solved.ac 난이도와 레이팅 상태를 표시하는 Tampermonkey 스크립트입니다. BOJ·solved.ac의 공식 프로그램은 아닙니다.

**[스크립트 설치](https://raw.githubusercontent.com/planPt/boj-group-practice-tier/main/boj-group-practice-tier.user.js)** · [설치·키 발급 상세 안내](INSTALL.ko.txt) · [오류 제보](https://github.com/planPt/boj-group-practice-tier/issues)

## 빠른 설치

1. [Tampermonkey](https://www.tampermonkey.net/)를 설치합니다. Chrome 확장 프로그램 관리 → Tampermonkey → 세부정보에서 **사용자 스크립트 허용**을 켭니다.
2. 위 **스크립트 설치** 링크를 열고 설치합니다. 코드만 보이면 Tampermonkey 대시보드 → 유틸리티의 **URL 가져오기**에 같은 링크를 입력합니다. 또는 새 스크립트에 코드 전체를 붙여넣고 저장합니다.
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

## 기존 수동 설치판에서 갱신

`2026.11.21.1` 등 이전 파일로 설치했다면, **기존 스크립트 항목**의 코드를 이 저장소의 최신 `.user.js` 내용으로 한 번 교체하고 저장하세요. 새 항목을 중복 생성하지 마세요.

웹 배포판부터 `@updateURL`·`@downloadURL`이 포함됩니다. 이후 Tampermonkey가 사용자의 업데이트 설정에 따른 주기로 새 버전을 확인합니다. 즉시 업데이트를 보장하지 않으며, 새 권한이 필요한 변경은 추가 확인이 필요할 수 있습니다. 같은 스크립트 항목으로 갱신할 때 저장된 키는 유지됩니다.

## 키와 요청량

- 이 저장소에는 배포자의 **실제 Client ID·Secret이 없습니다**. 각자 발급한 키를 사용합니다.
- 입력한 키는 코드·페이지 DOM·localStorage에 넣지 않고 **Tampermonkey 스크립트 전용 저장소**에 보관합니다. 요청에는 solved.ac의 고정 HTTPS API 주소만 사용하며 쿠키를 보내지 않고 리다이렉트를 거부합니다. 아이콘은 `cdn.solved.ac`에서 불러옵니다.
- 이것은 개인 브라우저에서 사용하는 구성입니다. solved.ac의 키 발급 화면은 서버 보관을 안내하며, 브라우저 저장은 서버 보관과 동일한 보안 수준이 아닙니다. 하나의 Secret을 다른 사용자에게 배포하지 마세요.
- **저장소를 포함한 Tampermonkey 백업은 공유하지 마세요.** `Include script storage`를 켠 내보내기에 입력한 키가 포함될 수 있습니다. 코드나 설치 링크만 공유하세요.
- 문제는 5개씩 묶어 조회하고 요청 간격은 최소 1.6초, 캐시 유효기간은 5분입니다. 10문제는 보통 2회 검색 요청입니다.
- **탭 사이 캐시는 공유하지 않습니다.** 같은 키를 사용하는 여러 탭·기기는 앱 호출 한도를 공유합니다. HTTP 429 응답의 재시도 대기 시간을 존중합니다.
- 키 유출이 의심되면 Backstage에서 해당 키를 폐기하세요. 메뉴의 **저장한 solved.ac API 키 지우기**는 브라우저 저장값만 삭제하며 서버의 키를 폐기하지 않습니다.

## 확인 범위

실제 BOJ 그룹 연습 DOM과 solved.ac v4 응답을 대조하고, 번호 매핑·상태 판정·중복 요청·동적 갱신·인증 실패·잘못된 응답·타임아웃 등에 대한 로컬 검사 16개 및 독립 검수를 통과한 실행 코드를 사용합니다. 최초 웹 배포판 `2026.11.21.2`는 이 코드의 배포 메타데이터만 변경했습니다.

이 검증은 모든 사용자 환경에서의 설치·자동 업데이트 완료를 보장하지 않습니다. 오류 제보에는 문제 번호와 오류 문구만 첨부하고 비밀키를 포함하지 마세요.

## 참고

- [solved.ac API 문서](https://backstage.solved.ac/developer/docs)
- [solved.ac 기여·레이팅 기준](https://solved.ac/ko/guideline)
- [solved.ac 개발자 약관](https://solved.ac/developer-terms)
- [Tampermonkey 사용자 스크립트 허용](https://www.tampermonkey.net/faq.php?locale=en&q=Q209)
- [Tampermonkey 업데이트 메타데이터](https://www.tampermonkey.net/documentation.php?locale=en&q=update_url)
- [배포 관리 안내](MAINTAINING.md)
