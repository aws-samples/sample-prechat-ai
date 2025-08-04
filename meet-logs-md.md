# AnyCompany

## Account Info

>**📌 Account에 대한 전반적인 정보를 작성하여 주세요. 모든 항목은 Optional 입니다.**

| SFDC URL                   | TBU                                                          |
| -------------------------- | ------------------------------------------------------------ |
| Site URL                   | TBU                                                          |
| Partner                    | TBU                                                          |
| Industry/Domain            | eg) #SNI #eCommerce                                          |
| Business model             | eg) 기업의 복리후생제도 컨설팅, 아웃소싱 및 운영업무 대행    |
| Customer’s Key Requirement | eg) AWS Personalize 도입 고려중                              |
| Key Challenges             | eg) Oracle DB 사용중에 있음                                  |
| TAS                        | TBU                                                          |
| Chat Summary               | Saltware의 무상 구성구축으로 기본적인 세팅 4월에 완료. 이후 Migration 진행 중. Migration PoC 2-3달 후 나머지도 Migration 할지말지 결정 예정. |
| Developer status           | eg) PM 1명, 개발조직 있음, 분석팀 없음                       |
| Key Contact                | eg) 재빈/CTO/010-1111-1111/jaebin@amazon.com                 |
| Budget                     | TBU                                                          |

## Meeting Logs

#### Meeting Minute

* 팀 구분/R&R
* 복지몰 설명 : 고객사별로 상품 제안, 고객사별로 상품이 다름, 결제 방식도 다름 (포인트 사용 or 카드, 선물하기 기능 등), 2300개 정도 live, 상시/스팟식 모두 진행
    * web/app 다 하시고 계시고
    * 카테고리 : 상품, 여행, 공연, 교육 프로그램 등
    * 상품 : 직접 소싱, 연계해서 받아오는 것
    * 최근 주요 포커싱 : 건강, 힐링, 여행 쪽으로 포커싱 중
* 알고리즘은 기본적인 수준으로 general 하게 도입 후, 추후에 고객사별로 맞춤으로 develop
* 필요 데이터 : User events, Item metadata, User metada
    * requirement : 형식 schema
* 데이터 : 400만건 보유
* 질의 :  
    * 상품 추천 외 다른 서비스? Push 서비스? → EventBridge로 따로 만들 수 있음
        * 그룹이라는 AI 알고리즘 서비스 회사를 이용해봤었는데, Push 연동 됐었음
    * 상호작용 데이터 수집

#### F/up items

- [ ] Event Tracker로 상호작용 데이터 수집 가능할지? SaaS 추천? 하나는 설치해서 테스트 중
- [ ] 비슷한 고객 사례 // 금일 전달 내용으로 충분해 보임, SFID 등 추가 플레이 필요할 경우 제공해 드리기로 해요.
- [ ] 금일 본 Personalize 소개 자료

[AmazonPersonalize-youngjinKim-20230131.pptx (etbs).pptx](https://api.quip-amazon.com/2/blob/adK9AAWlu5I/xOnWIAoP0fzFbiCy0R-iaQ?name=AmazonPersonalize-youngjinKim-20230131.pptx%20(etbs).pptx&s=Ed2mAPtsOJ1t) 

- [ ] 테스트용 고객 데이터 공유가 가능한가 여쭈셨던 부분

일단 테스트 해보고 싶으신 것 같아서 개발자분들 따라오실 수 있는 github 실습 링크 제공
https://github.com/aws-samples/amazon-personalize-samples

- [ ] PoC 할 수 있는 간단한 Architecture 버전

* * *

## Account Planning (Optional)

>**📌 자유롭게 Account에 대한 플래닝 내용을 작성합니다. 별도의 템플릿을 따를 필요가 없으며 대략적으로 ”언제 이러한 것들을 해야 한다” 정도로만 작성하셔도 무방합니다.**



#### Question List

-Business

* 회사 설립일 : 2000년 8
* 서비스 출시일 : **가능한 빠르게 추진중**
* 서비스 이용자 규모 : **2,300 고객사 / 400만 건 구매 데이터**

-Wallet

* 매출 규모 : 
* 투자 유치 현황 or 자본금 규모 : 자본금 30억 5천만원
* 올해 인프라 투자 예산 규모 : 

-Infra

* 복지몰 개인화
    * 상호작용 기준: 
        * **상품**만 아니라 **이벤트 배너**와 상호작용 하는 내용도 기획하고 싶다.
    * PoC 범위: 
        * **가장 일반적**이며 **사전 구성된 사용사례**를 **구현**하고 싶다.
        * PoC 에서는 이제너두 임직원 복지몰 데이터로, 1회성 학습하여 확인해 볼 요량
        * 먼 미래에는 고객별 캠페인을 쪼개어 전용 ML 을 하나씩 마련해 보고 싶다.
        * **운영에서는 배치 또는 실시간 데이터 섭식 구현하여야 함**
    * 현재 데이터 정보:
        * 2,300 개 고객사 / 400만 건 구매 데이터
        * 상호작용 데이터 **ZERO**
* 데이터 역량
    * 데이터 전담 조직 ZERO
    * ML 훈련/운영 역량 ZERO
    * 과거 Lessoned Learn 통해 전담 인력을 한 명 이상 세울것을 강조, 납득.

-Plan

* 25년 비즈니스적 목표 및 계획 : 
* 25년 서비스 인프라(AWS 관련 포함)의 목표 및 계획 : 

-Selling Point

* 상무 님 Input 에 의해 AI/ML 활용해 눈에 보이는 아웃컴을 전달하고 싶으신 상황
* Personalize 가 제공하는 ECOMMERCE 유스케이스로 요건을 구현하실 수 있다는 점 (Domain Recommender 로 선행 강조)

-Blockers

* **상호작용 데이터 전무**, 구글 애널리틱스 데이터를 내보낼 수 없다고 한다.

=> 데이터가 쌓일 때까지 물리적으로 기다려야 한다.

* **End-to-End 경쟁 솔루션**, 클릭스트림 섭식까지 함께 커버해주는 서비스인 **Groobee** 와 비교하기 때문에, **Amazon Personalize 의 범위**에 대해 오해가 있으셨음. 스트림 수집 에이전트, Glue, Kinesis 를 함께 활용해야 하는 점이 부담이라고 하였음.

=> 리테일 클릭스트림 수집용 오픈소스, 파트너 솔루션 탐색 후 제언드리기
=> Pricing 비교

* **데이터 역량 부족**, 솔트웨어로 1회성 Outcome 만들어도 운영 역량이 부족함

=> SFID 수준으로 깊이 실습해 보는 이벤트가 요구될 수 있음.