# -*- coding: utf-8 -*-
"""Generate KAIST OverEdge application PDFs (별첨1, 별첨2)."""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle,
    PageBreak,
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from PIL import Image as PILImage

BASE_DIR = r"C:\Users\김찬혁\Desktop\cupid"
ASSETS = os.path.join(BASE_DIR, "idea_design_assets")

pdfmetrics.registerFont(TTFont("Malgun", r"C:\Windows\Fonts\malgun.ttf"))
pdfmetrics.registerFont(TTFont("MalgunBd", r"C:\Windows\Fonts\malgunbd.ttf"))
pdfmetrics.registerFontFamily(
    "Malgun", normal="Malgun", bold="MalgunBd", italic="Malgun",
    boldItalic="MalgunBd",
)


def mk(name, size=10, leading=15, align=TA_LEFT, after=4, before=0,
       color=colors.black, left=0, bold=False):
    return ParagraphStyle(
        name=name, fontName="MalgunBd" if bold else "Malgun",
        fontSize=size, leading=leading, alignment=align,
        spaceAfter=after, spaceBefore=before,
        textColor=color, leftIndent=left,
    )


BODY = mk("body", 10, 15.7, TA_JUSTIFY, 4)
BODYS = mk("bodys", 9.7, 14.5, TA_JUSTIFY, 3)
SMALL = mk("small", 9, 12.5, after=3, color=colors.HexColor("#444"))


# =========================================================================
# 별첨 1 (KAIST OverEdge 창업 아이디어 기술서)
# =========================================================================

def attach1_header(label, title):
    blue = colors.HexColor("#1f3a93")
    cell_label = Paragraph(
        f'<para align="center"><font color="white" size="14">'
        f'<b>별첨</b><br/><b>{label}</b></font></para>',
        mk("hdr", 14, 18, TA_CENTER, 0, color=colors.white, bold=True))
    cell_title = Paragraph(
        f'<para align="left"><font size="15">{title}</font></para>',
        mk("hdrt", 15, 19, TA_LEFT, 0))
    t = Table([[cell_label, cell_title]],
              colWidths=[28 * mm, 142 * mm], rowHeights=[18 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), blue),
        ("BOX", (1, 0), (1, 0), 0.7, colors.black),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (1, 0), (1, 0), 10),
    ]))
    return t


def gray_header(text, font_size=13):
    p = Paragraph(
        f'<para align="center"><b>{text}</b></para>',
        mk("gh", font_size, font_size + 5, TA_CENTER, 0, bold=True))
    t = Table([[p]], colWidths=[170 * mm], rowHeights=[10 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1),
         colors.HexColor("#bfbfbf")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.black),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    return t


def sub_header(text, font_size=12):
    p = Paragraph(
        f'<para align="center"><b>{text}</b></para>',
        mk("sh", font_size, font_size + 4, TA_CENTER, 0, bold=True))
    t = Table([[p]], colWidths=[170 * mm], rowHeights=[9 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1),
         colors.HexColor("#d9d9d9")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.black),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    return t


def summary_row(label, body_text):
    left = Paragraph(
        f'<para align="center"><b>{label}</b></para>',
        mk("sl", 10, 14, TA_CENTER, 0, bold=True))
    right = Paragraph(body_text, BODY)
    t = Table([[left, right]], colWidths=[45 * mm, 125 * mm])
    t.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, colors.black),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.black),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("LEFTPADDING", (1, 0), (1, -1), 6),
        ("RIGHTPADDING", (1, 0), (1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return t


def fit_image(path, w_mm, h_max_mm):
    pi = PILImage.open(path)
    iw, ih = pi.size
    ratio = ih / iw
    w = w_mm * mm
    h = w * ratio
    if h > h_max_mm * mm:
        h = h_max_mm * mm
        w = h / ratio
    return Image(path, width=w, height=h, hAlign="CENTER")


def img_para(path, w_mm=145, h_max_mm=50, caption=None):
    out = [fit_image(path, w_mm, h_max_mm)]
    if caption:
        out.append(Paragraph(
            f'<para align="center"><font size="8" color="#555">'
            f'{caption}</font></para>',
            mk("cap", 8, 10.5, TA_CENTER, 6)))
    return out


def img_grid(paths_with_caption, cell_w_mm=75, cell_h_mm=38,
             grid_caption=None):
    """2x2 grid of images with optional individual subcaptions."""
    cells = []
    for path, sub in paths_with_caption:
        inner = [fit_image(path, cell_w_mm - 2, cell_h_mm)]
        if sub:
            inner.append(Paragraph(
                f'<para align="center"><font size="7" color="#666">'
                f'{sub}</font></para>',
                mk("subcap", 7, 9, TA_CENTER, 0)))
        cells.append(inner)
    table_rows = [
        [cells[0], cells[1]],
        [cells[2], cells[3]],
    ]
    t = Table(table_rows, colWidths=[cell_w_mm * mm, cell_w_mm * mm])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    out = [t]
    if grid_caption:
        out.append(Paragraph(
            f'<para align="center"><font size="8" color="#555">'
            f'{grid_caption}</font></para>',
            mk("cap", 8, 10.5, TA_CENTER, 6)))
    return out


def data_table(rows, col_widths=None, header_row=True, font_size=9):
    t = Table(rows, colWidths=col_widths)
    style = [
        ("FONTNAME", (0, 0), (-1, -1), "Malgun"),
        ("FONTSIZE", (0, 0), (-1, -1), font_size),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#7388b5")),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]
    if header_row:
        style += [
            ("BACKGROUND", (0, 0), (-1, 0),
             colors.HexColor("#eef2fb")),
            ("FONTNAME", (0, 0), (-1, 0), "MalgunBd"),
        ]
    t.setStyle(TableStyle(style))
    return t


# ----- 250자 이내, "~다" 종결, "—" 없음 -----

PROBLEM_250 = (
    "개발자는 평균 월 $392을 AI에 쓰고 있다. 내가 KAIST 학생·동료 개발자를 "
    "대상으로 진행한 자체 설문에서도 응답자 62.1%가 'AI 비용이 부담된다'고 "
    "답했다. 그럼에도 시장에는 주석 한 줄 고치든 보안 모듈을 새로 짜든 "
    "동일하게 frontier 모델을 호출하는 관행이 굳어 있고, 어떤 작업을 어떤 "
    "모델로 보낼지 자동으로 결정해 줄 layer 자체가 없다. AI 코딩 비용은 지금 "
    "통제 불가능한 비용으로 더 빠르게 굳어져 가는 중이다."
)

SOLUTION_250 = (
    "CUPID는 들어오는 prompt를 task 단위로 자동 분류해 비용·성능·context에 "
    "가장 잘 맞는 모델로 라우팅해 주는 AI-native development operating "
    "layer다. brick-out 게임 데모에서 Router $0.0154 vs Opus $0.2806, "
    "단일 요청 기준 94.5% 비용 절감을 실측했다. 모델 선택 근거를 UI에 그대로 "
    "노출해 자동화를 사용자가 검증할 수 있게 만든 것이 핵심 차별점이다."
)

AI_250 = (
    "신청자는 GESS KAIST 예비창업팀 CUPID의 CEO다. 매주 LLM API 가격·모델 "
    "강점·task 적합도를 추적하는 일이 곧 본인의 일과이며, 5단 파이프라인"
    "(Optimizer, Classifier, Cupid Engine, Context, Execution)을 직접 "
    "설계·구현해 MVP에 반영했다. task 분류는 LLM-as-classifier와 rule-based "
    "hybrid 구조로 latency 30ms 이하로 유지하고 있다."
)


# ----- 상세: 1. Problem -----

def add_problem_detail(s):
    s.append(Paragraph(
        "이 아이디어는 거창한 시장 보고서에서 시작된 게 아니다. <b>GESS "
        "KAIST 프로그램을 함께 진행하던 팀원들과 '요즘 AI 결제 영수증이 "
        "무섭다'는 대화에서 출발</b>했다. 카드 명세를 다시 열어 보니 나만 "
        "해도 Claude Max 한 줄에 한 달 약 $200이 빠지고 있었고, 다섯 명 팀에서 "
        "셋이 비슷한 수준을 매달 결제하고 있었다. 한 사람의 통증이 아닌지 "
        "확인하려고 짧은 설문과 인터뷰부터 돌렸고, 그 결과 같은 통증이 "
        "KAIST 안에서뿐 아니라 글로벌에서도 동일한 형태로 진행되고 있다는 "
        "사실을 확인했다.", BODY))

    s.append(Paragraph(
        "<b>1) 시장 데이터: 이 통증은 글로벌이다</b>", BODY))
    s.append(Paragraph(
        "Stanford AI Spend Index에 따르면 개발자 한 명이 매달 AI에 쓰는 "
        "금액은 평균 <b>$392</b>이다. 내가 KAIST 학부·대학원생을 대상으로 직접 "
        "진행한 자체 설문에서도 응답자 <b>62.1%가 'AI 비용이 부담된다'</b>에 "
        "동의했고, 27.6%가 중립, 부정 답변은 10.3%에 그쳤다. IBM 자료에 "
        "따르면 AI 개발자의 <b>72%가 단일 AI 앱을 만드는 데 5~15개의 도구를 "
        "병행</b>하고 있으며, 그 사이를 오갈 때마다 같은 설명을 반복하면서 "
        "input token이 새고 있다. Gartner는 <b>2026년 전세계 AI 지출이 $2.5T, "
        "전년 대비 +44%</b>로 성장할 것이라 전망한다. 같은 자료에 따르면 새로 "
        "작성되는 코드의 46%가 이미 AI 보조로 쓰이고 있고, 2026년 말에는 그 "
        "비율이 80%까지 올라간다. 2025년 미국 개발자의 AI 코딩 일일 채택률은 "
        "약 92%다. 사용자 풀은 이미 글로벌 표준으로 자리잡았고, 비용만 통제 "
        "되지 않은 채 빠르게 커지고 있다는 뜻이다.", BODY))

    s.append(Paragraph(
        "<b>2) 인터뷰에서 잡힌 진짜 통증</b>", BODY))
    s.append(Paragraph(
        "Toss 백엔드 엔지니어 <b>권혁태(Larry)</b> 님과의 1:1 인터뷰에서 "
        "들었던 말이 가장 인상적이었다. \"heavy AI coder는 이미 premium 모델에 "
        "의존하지만, 그 비용을 정당화하기가 점점 어려워진다. 한 번 결제로 "
        "여러 모델을 효율적으로 쓸 수 있다면 즉시 가입하겠다\"는 답이었다. "
        "카카오 AI 육성 프로젝트에서 알게 된 동료 개발자들, 그리고 KAIST 내 "
        "SPARCS·Include·KE 멤버들과의 짧은 인터뷰도 결이 같았다. 다들 Claude·"
        "GPT·Gemini를 동시에 구독하면서도 '지금 어떤 모델로 보낼지'는 매번 "
        "감으로 정하고 있었고, 결제 영수증을 받고 나서야 비용을 인식하는 "
        "패턴이 공통적이었다.", BODY))

    s.append(Paragraph(
        "<b>3) 문제의 구조: 네 가지</b>", BODY))
    s.append(Paragraph(
        "<b>첫째, 모델 가격은 task 난이도와 무관하게 동일 단위로 청구된다.</b> "
        "주석 한 줄을 고치는 데도 Claude Opus를 부르는 것이 디폴트가 되어 "
        "있다. 같은 10M 토큰을 한 달 동안 사용한다고 가정하면 모델별 월 "
        "비용은 다음과 같이 두 배 이상 벌어진다.", BODY))
    s.append(data_table([
        ["모델", "월 비용 (10M tok)", "강점"],
        ["Claude Opus 4.7", "$142.2",
         "Multi-file reasoning, Architecture decision"],
        ["GPT-5.4", "$82.6",
         "General coding, Multi-step, Native computer-use"],
        ["Gemini 2.5 Pro", "$49.6",
         "Long-context 분석, Multi-modal"],
    ], col_widths=[42 * mm, 38 * mm, 90 * mm]))
    s.append(Spacer(1, 4))
    s.append(Paragraph(
        "<b>둘째, 모델별 강점이 다르지만 매번 그것을 판별할 시간과 정보가 "
        "없다.</b> Opus는 multi-file reasoning과 architecture decision에, "
        "GPT-5는 native computer-use에, Gemini는 long-context와 멀티모달에 더 "
        "낫다. 그러나 작업 직전마다 '지금 이 task는 어디로 보낼까'를 판단하는 "
        "인지 비용은 결제 비용만큼이나 무겁다.", BODY))
    s.append(Paragraph(
        "<b>셋째, IDE, chat tool, 외부 도구 사이를 오갈 때마다 context가 "
        "끊긴다.</b> 같은 repo와 같은 작업 흐름인데도 새 도구에 들어갈 때마다 "
        "프로젝트 설명, 코딩 컨벤션, 직전 결정을 다시 입력해야 한다. 이 부분은 "
        "내가 SPARCS에서 OTL 서비스를 개발하면서 직접 부딪힌 통증이기도 하다.",
        BODY))
    s.append(Paragraph(
        "<b>넷째, 팀과 기업 입장에서 누가 어떤 모델로 무엇을 했는지 추적할 "
        "governance 도구가 없다.</b> Uber가 2026년 사내 AI 코딩 도구 라이선스 "
        "비용으로 전년 대비 약 4배 비용을 보고한 사례, Microsoft가 Claude Code "
        "엔터프라이즈 라이선스를 사내 표준으로 도입한 사례는 이 통제 부재가 "
        "이미 비용 사고로 번지고 있다는 신호다.", BODY))

    s.extend(img_para(
        os.path.join(ASSETS, "img1_cupid_ide_concept.png"),
        w_mm=145, h_max_mm=48,
        caption=("[그림 1] CUPID 최종 지향점인 3-panel IDE. 좌측 file "
                 "explorer, 중앙 code editor, 우측 Copilot panel과 "
                 "실시간 비용 대시보드인 CUPID Arbitrage가 함께 보인다.")))

    s.append(Paragraph(
        "<b>4) 페르소나 인터뷰: Hyeoktae Kwon (Larry)</b>", BODY))
    s.append(Paragraph(
        "Toss Backend Engineer, heavy AI coder, Claude $200/월 결제. "
        "<i>\"Heavy AI coders already rely on premium models, but the cost "
        "is becoming hard to justify.\"</i>  <i>\"If I could pay for one "
        "plan and use multiple models efficiently, I'd subscribe "
        "immediately.\"</i> 짧은 두 문장이지만, heavy user가 가장 솔직하게 "
        "꺼낸 말이라는 점에서 우리는 이 말을 가장 무겁게 받아들였다.", BODY))

    s.append(Paragraph(
        "<b>5) 결론: 왜 지금 풀어야 하는 문제인가</b>", BODY))
    s.append(Paragraph(
        "비용 통제 도구가 없으면 결국 보수적으로 가장 비싼 모델을 부르게 "
        "되고, 그것이 다시 비용을 누적시킨다. <b>비용 부재가 비용을 만드는 "
        "악순환</b>이다. AI 인프라 전력 소비량이 2024년 415TWh에서 2030년 "
        "945TWh로 두 배 넘게 늘 것이라는 IEA 예측까지 함께 놓고 보면, 이 "
        "문제는 개인 결제의 부담을 넘어 산업·사회적 비용으로 확대된다. "
        "AI 코딩이 1~2년 안에 코드의 80%를 차지하게 된다는 사실은, <b>지금 "
        "비용 통제 layer를 잡지 못하면 그 비용 구조가 다음 세대 IDE의 "
        "디폴트로 굳어진다</b>는 뜻이다. 같은 통증을 직접 겪고 있는 KAIST "
        "학생 개발자의 시각과 KAIST 기술경영학부의 시장 시각을 동시에 가진 "
        "신청자에게, 이것은 단순한 시장 기회가 아니라 GESS 기간을 다 쓰면서 "
        "가장 자신 있게 잡을 수 있는 지금 시점의 창업 카테고리다.", BODY))


# ----- 상세: 2. Solution -----

def add_solution_detail(s):
    s.append(Paragraph(
        "CUPID는 'AI를 더 많이 쓰게 하는 IDE'가 아니다. <b>'AI를 가장 합리적 "
        "으로 쓰게 만드는 IDE'</b>다. 다시 말해 IDE를 처음부터 새로 짜는 것이 "
        "아니라, 개발자가 이미 익숙한 VS Code 경험 위에 AI orchestration "
        "layer 한 겹을 얹는 형태로 설계되어 있다. 그래서 사용자의 학습 비용은 "
        "사실상 0이며, 동시에 기존 chat 기반 도구가 줄 수 없는 '이 모델로 "
        "보내라, 이런 이유로'라는 결정 정보를 자연스럽게 화면 위로 끌어올릴 "
        "수 있다.", BODY))

    s.append(Paragraph(
        "<b>1) 내부 구조: 5단 파이프라인</b>", BODY))
    s.append(Paragraph(
        "사용자가 prompt 한 문장을 보내면 내부적으로 다섯 단계가 순서대로 "
        "동작한다. <b>(1) Prompt Optimizer</b>는 pruning과 history "
        "summarization, semantic code mapping을 통해 input token을 평균 "
        "30% 줄인다. <b>(2) Task Classification Engine</b>은 들어온 prompt를 "
        "simple edit, explanation, test generation, bug fix, API "
        "implementation, schema 변경, security-sensitive change, multi-file "
        "refactor 등의 task type으로 분류한다. 이때 cheap tier의 "
        "LLM-as-classifier(예: Claude Haiku 4.5)와 rule-based hybrid 구조를 "
        "함께 사용해 분류 latency를 30ms 이하로 유지한다.", BODY))
    s.append(Paragraph(
        "<b>(3) Auto-selection Cupid Engine</b>은 분류 결과를 받아 cheap, mid, "
        "strong, long-context, local 다섯 tier 중에서 비용과 품질 score를 "
        "함께 본 매트릭스로 최적 모델을 선택한다. <b>(4) Context Preservation "
        "Layer</b>는 repo summary, coding convention, recent task history, "
        "architecture decision log를 vector store에서 끌어와 prompt 앞부분에 "
        "자동으로 주입한다. 같은 설명을 반복하지 않아도 된다는 의미다. "
        "<b>(5) Model Execution + Transparent Cost Analytics</b> 단계에서는 "
        "실행 결과와 함께 router cost, benchmark cost, latency, 그리고 결정 "
        "근거(reasoning)가 우측 CUPID Arbitrage 패널에 즉시 갱신된다.", BODY))

    s.extend(img_para(
        os.path.join(ASSETS, "img2_model_routing_diagram.png"),
        w_mm=145, h_max_mm=46,
        caption=("[그림 2] Technology Workflow. Prompt Optimizer, Cupid "
                 "Engine, Model Execution이 Context Storage를 공유하는 구조")))

    s.append(Paragraph(
        "<b>2) 차별성: Cursor·Windsurf·Replit과 같은 축에서 경쟁하지 않는다</b>",
        BODY))
    s.append(Paragraph(
        "<b>첫째, CUPID는 '더 좋은 코딩 도구'가 아니라 그 위에 얹는 메타 "
        "레이어다.</b> Cursor, Windsurf, Replit, GitHub Copilot 등이 '더 똑똑한 "
        "AI 코딩 도구'의 축에서 경쟁할 때, CUPID는 그 위에서 '지금 이 작업은 "
        "어떤 모델로 가야 가장 합리적인가'를 결정하는 단계 자체를 새로 카테고리 "
        "화한다. 자체 경쟁사 비교에서 Cost optimization, Transparent Model "
        "Routing, Automatic Model Routing, Context across different AI models, "
        "One-click deployment, AI-native coding environment 여섯 축 모두에서 "
        "Copilot 대비 우위를 확보한다.", BODY))
    s.append(Paragraph(
        "<b>둘째, 결정 transparency가 핵심 가치다.</b> ROUTING ENGINE 패널은 "
        "\"Detected: Explanation task. Routing to GPT-4o for clarity & "
        "documentation.\"처럼 작업 분류와 선택 이유를 자연어로 그대로 드러낸다. "
        "사용자는 자동화의 결과만 받는 것이 아니라 자동화의 판단 자체를 "
        "검증할 수 있다. 우리가 처음부터 '왜 이 모델이냐'를 항상 보여 주기로 "
        "결정한 이유는, 신뢰가 곧 retention이라고 판단했기 때문이다.", BODY))
    s.append(Paragraph(
        "<b>셋째, context preservation을 별도 layer로 제공한다.</b> 같은 repo, "
        "같은 작업 흐름에서 모델만 바뀌어도 이전 결정과 context가 살아 있어 "
        "흐름이 끊기지 않는다. <b>넷째, 비용 정보를 월말 청구서가 아니라 "
        "요청 직전과 직후 실시간으로 노출한다.</b> 비용을 '나중에 알게 되는 "
        "것'에서 '의사결정의 일부'로 끌어올린다는 디자인 원칙이다.", BODY))

    s.append(Paragraph(
        "<b>3) 가장 강력한 증거: 94.5% 실측 절감</b>", BODY))
    s.append(Paragraph(
        "Compare 콘솔에 \"I want to make a simple brick out game, make the "
        "game as a web game for me.\"라는 prompt를 입력했을 때, CUPID는 이 "
        "task를 cheap tier로 라우팅했다. 같은 prompt를 router 모델과 Claude "
        "Opus 4가 동시에 호출되어 결과 품질을 같은 조건에서 비교할 수 있었고, "
        "그 결과 <b>Router $0.0154 vs Benchmark(Opus) $0.2806, 단일 요청 기준 "
        "94.5%($0.2652) 비용 절감</b>을 기록했다. 두 응답 모두 작동하는 brick-"
        "out 게임 코드였고, 둘 사이의 품질 차이가 사실상 무시할 수 있는 "
        "수준이었다는 점이 우리에게는 가장 중요한 신호였다. KAIST AI club "
        "Include의 회장 <b>원대한</b> 님은 \"언제 publish하느냐, Claude Max "
        "대신 바로 쓰고 싶다\"고 답했고, HCITech Lab의 <b>Murad Eynizada</b>"
        "(석사생) 님은 \"이건 진짜로 시간과 API 비용을 동시에 아껴 줄 것 "
        "같다\"고 답했다.", BODY))

    s.extend(img_para(
        os.path.join(ASSETS, "img4_demo_breakout_compare.png"),
        w_mm=145, h_max_mm=46,
        caption=("[그림 3] Compare 콘솔에서 router 모델과 Claude Opus 4를 "
                 "병렬로 비교한 결과. Cost savings 94.5%와 Routing reasoning이 "
                 "한 화면에 같이 노출된다.")))

    s.append(Paragraph(
        "<b>4) Business Model: 구독 + AI Credits 결합</b>", BODY))
    s.append(Paragraph(
        "1년차의 핵심 수익원은 B2C 구독과 사용량 기반 wallet인 AI Credits을 "
        "결합한 구조다. Credits는 provider token pricing과 직접 연동되며, "
        "사용자는 BYOK(자신의 API 키)와 CUPID managed credit 두 방식을 모두 "
        "선택할 수 있다. Free 플랜은 체험용으로 부담 없이 들어오게 하고, "
        "Pro 플랜은 일반 개발자의 일상 사용을, Max 플랜은 heavy user와 "
        "스타트업 팀을 타깃으로 한다.", BODY))
    s.append(data_table([
        ["플랜", "월 요금", "포함 Credit", "Repo memory",
         "주요 기능"],
        ["Free", "$0", "$1/mo", "1 / session",
         "Basic routing, 체험용"],
        ["Pro", "$16", "$10/mo", "5 / session",
         "Full routing + Repo memory"],
        ["Max", "$69", "$40/mo", "25 / session",
         "Advanced analytics + AI Credit"],
    ], col_widths=[18 * mm, 18 * mm, 24 * mm, 28 * mm, 82 * mm]))
    s.append(Spacer(1, 4))

    s.append(Paragraph(
        "<b>5) 시장과 GTM 3단계</b>", BODY))
    s.append(Paragraph(
        "Global AI Coding Tools Market을 TAM($110B), 그 안에서 multi-model을 "
        "동시 사용하는 developer 시장을 SAM($20B), 그 중 월 $100 이상을 "
        "결제하는 AI-heavy developer를 SOM($600M)으로 정의한다. 1차 타깃은 "
        "SOM 안의 heavy user다. GTM은 3단계 로드맵으로 설계되어 있다. "
        "<b>Year 1</b>에는 B2C 구독 + AI Credits 모델로 사용자 풀을 확보한다. "
        "KAIST·국내 스타트업 커뮤니티·실리콘밸리 KAIST 동문 네트워크를 1차 "
        "유입 채널로 활용한다. <b>Year 2</b>에는 1년차에 축적된 task type별 "
        "AI 사용 데이터를 정제해 'AI Performance Data' 상품으로 OpenAI·"
        "Anthropic·Google에 B2B 판매한다. <b>Year 5</b>에는 모델 제공사와 "
        "partnership 형태로 발전시켜 LLM 라우팅 인프라 자체를 B2B 상품화 "
        "한다. 같은 layer가 시장 전체의 routing standard가 될 수 있도록 "
        "초기부터 protocol 형태의 설계를 함께 가져간다.", BODY))
    s.append(Paragraph(
        "슬로건 <b>\"Don't code stupid. Use Cupid.\"</b>는 단순한 카피가 "
        "아니라, 우리가 사용자에게 던지는 가장 솔직한 약속이다. 더 비싼 "
        "모델을 더 많이 쓰는 것은 똑똑한 선택이 아니며, CUPID는 그 똑똑한 "
        "선택을 자동화한다.", BODY))


# ----- 상세: 3. AI 활용 역량 -----

def add_ai_detail(s):
    s.append(Paragraph(
        "CUPID는 그 자체로 AI Agent orchestration 제품이기 때문에, 'AI를 잘 "
        "쓸 수 있는가'는 신청자에게 단순한 역량 항목이 아니라 일과 자체다. "
        "다시 한 번 분명히 해 두자면, <b>본 아이디어는 신청자 본인이 GESS "
        "KAIST 2026 프로그램 기간 중에 직접 떠올리고 다듬어 온 것</b>이며, "
        "신청자는 현재 같은 프로그램의 예비창업팀 CUPID에서 <b>CEO(대표) "
        "역할</b>을 맡고 있다. GESS 활동이 종료된 뒤에는 외국인 팀원들이 "
        "본국으로 돌아가는 가능성을 고려해, <b>신청자 단독 또는 KAIST 내 "
        "1~2명의 합류 멤버와 함께 동일 아이템으로 법인 창업까지 이어 가려는 "
        "예비창업 단계</b>에 있다.", BODY))

    s.append(Paragraph(
        "<b>1) AI 도메인 + 개발자 도메인 전문성: 사람 차원</b>", BODY))
    s.append(Paragraph(
        "<b>카카오 AI 육성 프로젝트(팀 ANCHOR) 본선 진출.</b> 컴퓨터비전 기반 "
        "택시 합류 서비스를 기획·개발하면서 '더 큰 모델이 정답이 아닌 경우'를 "
        "처음 직접 다뤘다. 가벼운 vision 모델이 frontier 모델보다 task에 더 "
        "맞을 수 있다는 감각을 이 프로젝트에서 체득했다.", BODY))
    s.append(Paragraph(
        "<b>Include (KAIST AI 동아리).</b> Attention is all you need 등 논문 "
        "세미나를 진행했고, 딥페이크 판별 모델과 RAG 기반 금융 어시스턴트를 "
        "직접 구현했다. STDev 사이언스 해커톤 2026에서는 수학 공식 기반 퍼즐 "
        "게임 Mathle(Math+Wordle)로 3등 수상까지 이어졌다.", BODY))
    s.append(Paragraph(
        "<b>SPARCS (KAIST 개발자 동아리).</b> KAIST 학생 거의 전원이 사용하는 "
        "수강신청·시간표 서비스 OTL의 백엔드 개발자로 활동 중이다. NestJS, "
        "Prisma, MySQL/MariaDB, Docker, Git 등 실제 운영 서비스의 기술 스택을 "
        "다루고 있고, 매학기 수강신청 트래픽 피크 같은 실서비스 환경의 부하 "
        "이슈와 디버깅을 경험했다. CUPID는 결국 '개발자가 자기 IDE 안에서 "
        "쓰는 도구'이기 때문에, 진짜 개발자가 진짜 코드를 다루며 부딪히는 "
        "통증을 안다는 점이 이 제품 설계에서 가장 큰 자산이라고 본다.", BODY))
    s.append(Paragraph(
        "<b>Google I/O 2026 Student Ambassador (한국 대표 4인 중 1인).</b> "
        "CA 마운틴뷰 현장에서 키노트와 발표를 직접 조사했고, Google AI "
        "subscription 총괄 PM 등 다수의 구글러와 인터뷰하며 글로벌 AI 제품의 "
        "방향을 정리했다. 미국·인도·일본 학생 대표들과의 네트워킹과 내부 "
        "해커톤도 함께 경험했다.", BODY))
    s.append(Paragraph(
        "<b>E*5 KAIST 본선 진출 (팀 viral plane).</b> 블루포인트파트너스, "
        "한국투자증권, 카카오벤처스 등 VC 소속 멘토에게 멘토링을 받으며, "
        "기술적 가능성과 시장 수요를 동시에 설명하는 훈련을 했다. 이 경험은 "
        "CUPID의 시장 정의와 GTM 설계에 직접 반영되었다.", BODY))

    s.append(Paragraph(
        "<b>2) 제품 차원의 AI 활용: Agent와 외부 모델 두 층위</b>", BODY))
    s.append(Paragraph(
        "<b>(1) AI Agent 활용.</b> CUPID는 내부적으로 작은 Agent들의 체인 "
        "구조로 설계되어 있다. Optimizer Agent는 prompt 압축과 history "
        "summarization을 담당하고, Classifier Agent는 task type을 task type, "
        "risk, difficulty, context size의 다중 라벨로 분류하며, Router Agent는 "
        "결정 정책을 가지고 모델을 선택한다. Context Agent는 repo summary와 "
        "decision memory를 vector store에서 끌어와 prompt에 주입한다. 이 "
        "Agent들은 외부 frontier 모델 API를 도구처럼 호출하는 형태로 동작하고, "
        "모든 step의 입출력은 trace로 기록되어 사후 검증이 가능하다. 다음 "
        "단계로는 사용자 본인의 코딩 패턴을 학습하는 personal Agent까지 "
        "확장할 계획이다.", BODY))
    s.append(Paragraph(
        "<b>(2) 외부 AI 모델 활용.</b> 1차 라우팅 풀은 다음 4개 provider로 "
        "구성된다. 사용자는 BYOK(자신의 API 키)와 CUPID managed credit 두 "
        "방식을 모두 선택할 수 있으며, local 또는 private 모델(예: 사내 LLM)을 "
        "라우팅 후보에 끼우는 B2B 옵션도 설계에 들어가 있다.", BODYS))
    s.append(data_table([
        ["Provider · 모델", "Input (per 1M)", "Output (per 1M)",
         "주요 라우팅 용도"],
        ["OpenAI GPT-5.5", "$2.5 ~ 5", "$15 ~ 22.5",
         "General coding, computer-use"],
        ["Anthropic Claude Opus 4.7", "$5", "$25",
         "Multi-file refactor, security"],
        ["Google Gemini 3.1 Pro", "$2 ~ 4", "$12 ~ 18",
         "Long-context, multi-modal"],
        ["Perplexity Sonar Pro", "$3", "$15",
         "Research-heavy task"],
    ], col_widths=[48 * mm, 28 * mm, 28 * mm, 66 * mm], font_size=8.7))
    s.append(Spacer(1, 4))

    s.append(Paragraph(
        "<b>3) 현재 활용 현황: 작동 중인 코드</b>", BODY))
    s.append(Paragraph(
        "CUPID는 계획 단계의 그림이 아니라 이미 로컬에서 실제로 돌아가는 "
        "코드다. backend는 TypeScript와 NestJS 기반으로 위 5단 파이프라인을 "
        "모두 구현했고, frontend는 두 콘솔로 나뉘어 있다. <b>Compare 콘솔</b>은 "
        "동일 prompt를 router 모델과 baseline(Claude Opus 4)이 병렬 호출해 "
        "결과·비용·latency를 한 화면에서 비교할 수 있도록 만든 검증 환경이고, "
        "<b>Pipeline 콘솔</b>은 User Prompt, Cupid Engine, Prompt Optimizer, "
        "Context Storage, Model Execution으로 이어지는 6-노드 그래프를 SSE로 "
        "실시간 점등하는 trace 화면이다. LLM-assisted classification 결과(예: "
        "api_implementation, risk 2, difficulty 1, small context 등)도 UI에 "
        "그대로 노출된다.", BODY))

    # 2x2 image grid: 지향점 UI 2장 + 라이브 MVP 2장
    s.extend(img_grid([
        (os.path.join(ASSETS, "frame1_ide_three_panels.png"),
         "지향점 UI: 3-panel IDE 컨셉"),
        (os.path.join(ASSETS, "frame3_routing_engine_decision.png"),
         "지향점 UI: Routing Engine 결정 패널"),
        (os.path.join(ASSETS, "live", "brickout3_result_94p5.png"),
         "라이브 MVP: brick-out 94.5% 절감"),
        (os.path.join(ASSETS, "live", "shot5_pipeline_midrun.png"),
         "라이브 MVP: Pipeline 6-노드 SSE trace"),
    ], cell_w_mm=72, cell_h_mm=24,
       grid_caption=("[그림 4] 위 두 장은 최종 지향점 UI 디자인(데모 영상 "
                     "추출), 아래 두 장은 현재 로컬(localhost:5173)에서 "
                     "구동 중인 MVP의 라이브 캡처다.")))

    s.append(Paragraph(
        "<b>4) OverEdge 기간 동안의 추가 계획과 종료 시점 KPI</b>", BODY))
    s.append(Paragraph(
        "OverEdge 기간 동안에는 다섯 가지 트랙을 동시에 굴린다. ① task-level "
        "benchmark를 SWE-bench 등 더 다양한 코드베이스로 확장하여 라우팅 "
        "정확도를 정량 검증한다. ② VS Code extension 형태의 사용자용 MVP를 "
        "출시해 B2C 채널에 1차로 진입한다. ③ OAuth와 token usage 집계를 기반 "
        "으로 한 cost tracking dashboard를 정식 사용자에게 노출한다. ④ KAIST "
        "내 SPARCS·Include·KE 등 개발자/창업 동아리를 1차 early beta 채널로 "
        "활용해 100명 규모의 유저 테스트를 진행한다. ⑤ GESS 종료 후의 팀 "
        "구성을 마무리해 OverEdge 후반에는 법인 설립을 준비한다.", BODY))
    s.append(data_table([
        ["지표", "현재", "OverEdge 종료 시점 목표"],
        ["라우팅 정확도 (자체 task benchmark)",
         "100건 자체 운영", "500건, 정확도 90% 이상"],
        ["평균 cost saving (실측)",
         "단일 데모 94.5%", "유저 평균 50% 이상"],
        ["주요 사용자 수",
         "팀 내부 + 인터뷰 사용자",
         "KAIST·국내 학생/스타트업 100명+"],
        ["MVP 형태", "Compare / Pipeline 두 콘솔",
         "VS Code extension MVP 1차 출시"],
        ["팀 구성", "GESS 팀 5인 (CEO 포함)",
         "법인 코어 팀 1~3인 (CEO + 1~2)"],
    ], col_widths=[60 * mm, 50 * mm, 55 * mm]))
    s.append(Spacer(1, 4))

    s.append(Paragraph(
        "<b>5) GESS 이후 팀 구성과 마무리</b>", BODY))
    s.append(Paragraph(
        "현재 GESS 팀 CUPID는 본인 포함 5인(CEO 본인, CTO·CFO·CMO·COO는 외국인 "
        "팀원) 구성이다. GESS는 KAIST의 학생 기업가정신 프로그램이고 외국인 "
        "팀원 대부분은 종료 후 본국으로 돌아가, GESS 직후 핵심 의사결정은 "
        "\"누가 한국에 남아 끝까지 가느냐\"다. 신청자는 (1) 본인 단독 법인 "
        "설립 후 핵심 멤버 합류, (2) GESS 팀원 중 잔류 의향자 1명과 함께 "
        "시작, (3) KAIST 내 Include·SPARCS·KE 네트워크에서 CTO/CPO 후보 "
        "1~2명을 새로 합류시키는 안을 동시에 두고 OverEdge 기간 동안 정리해 "
        "후반에 법인 설립을 마무리한다.", BODY))
    s.append(Paragraph(
        "CUPID 아이디어는 본 신청자가 GESS 기간 중 <b>직접 정의·발전시킨 "
        "것</b>이며, 현재 같은 아이템으로 4대 과학기술원 창업리그 GRAVITY "
        "2026에도 <b>팀 CUPID의 CEO 자격</b>으로 참가신청한 상태다. 동일 "
        "아이디어가 서로 다른 외부 프로그램에서 동시에 검증을 받고 있으며, "
        "OverEdge는 <b>GESS 종료 직후 곧바로 법인 창업으로 넘어가는 결정적인 "
        "전환 구간</b>이 된다.", BODY))


# ===== 별첨 1 빌드 =====

def build_attach1(out_path):
    doc = SimpleDocTemplate(
        out_path, pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=18 * mm, bottomMargin=14 * mm,
        title="KAIST OverEdge 창업 아이디어 기술서_김지혁",
    )
    s = []

    for label, txt in [("Problem", PROBLEM_250),
                       ("Solution", SOLUTION_250),
                       ("AI", AI_250)]:
        n = len(txt)
        print(f"  [{label}] {n} chars")
        assert n <= 250, f"{label}: {n} > 250"
        assert "—" not in txt and "–" not in txt, f"{label} has dash"
        assert txt.rstrip().endswith("."), f"{label} does not end with period"

    # 페이지 1
    s.append(attach1_header("1", "KAIST OverEdge 창업 아이디어 기술서"))
    s.append(Spacer(1, 10))
    s.append(gray_header("요약 소개 (전체 1p 이내)"))
    s.append(Spacer(1, 4))
    s.append(summary_row(
        "1. Problem<br/>(풀고자 하는 문제)", PROBLEM_250))
    s.append(summary_row(
        "2. Solution<br/>(정의한 문제에 대한<br/>나의 솔루션)",
        SOLUTION_250))
    s.append(summary_row(
        "3. AI 활용 역량<br/>(AI 도메인 전문성 및<br/>활용 계획)",
        AI_250))

    s.append(PageBreak())

    # 상세
    s.append(gray_header("상세 소개 (항목 별 2p 이내)"))
    s.append(Spacer(1, 4))
    s.append(sub_header("1. Problem (풀고자 하는 문제)"))
    s.append(Spacer(1, 4))
    add_problem_detail(s)

    s.append(PageBreak())
    s.append(sub_header("2. Solution (정의한 문제에 대한 나의 솔루션)"))
    s.append(Spacer(1, 4))
    add_solution_detail(s)

    s.append(PageBreak())
    s.append(sub_header("3. AI 활용 역량 (AI 도메인 전문성 및 활용 계획)"))
    s.append(Spacer(1, 4))
    add_ai_detail(s)

    doc.build(s)


# =========================================================================
# 별첨 2 (KAIST OverEdge 증빙서류) — 원본 양식 그대로
# =========================================================================

def cb(checked):
    return "■" if checked else "□"


def build_attach2(out_path):
    doc = SimpleDocTemplate(
        out_path, pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=18 * mm, bottomMargin=16 * mm,
        title="KAIST OverEdge 증빙서류_김지혁",
    )
    s = []

    # [붙임1]
    s.append(Paragraph("<b>[붙임1]</b>",
                       mk("p", 11, 14, TA_LEFT, 4, bold=True)))
    title_box = Table([[Paragraph(
        '<para align="center">'
        '<font size="20"><b>개인정보 수집·이용 및 제공 동의서</b></font>'
        '</para>',
        mk("ttl", 20, 26, TA_CENTER, 0, bold=True))]],
        colWidths=[170 * mm], rowHeights=[16 * mm])
    title_box.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, -1), 1.5, colors.black),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    s.append(title_box)
    s.append(Spacer(1, 6))

    intro = Table([[Paragraph(
        "<b>KAIST 창업원 창업지원센터는 「KAIST OverEdge 프로그램」 운영을 "
        "위하여 아래와 같이 개인정보를 수집·이용·제공하고자 합니다. "
        "내용을 자세히 확인하신 후 동의 여부를 결정하여 주십시오.</b>",
        mk("intro", 9.5, 14, TA_LEFT, 0, bold=True))]],
        colWidths=[170 * mm])
    intro.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.7, colors.black),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    s.append(intro)
    s.append(Spacer(1, 12))

    s.append(Paragraph(
        "<b>□ 개인정보 수집·이용 내역</b>",
        mk("h", 11, 15, TA_LEFT, 4, bold=True)))
    t1 = Table([
        ["항목", "수집·이용 목적", "보유기간"],
        ["성명, 생년월일, 주소, 연락처 등",
         "프로그램 운영·관리, 성과확산 등",
         "프로그램 종료 후 5년까지"]],
        colWidths=[60 * mm, 60 * mm, 50 * mm])
    t1.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Malgun"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("BACKGROUND", (0, 0), (-1, 0),
         colors.HexColor("#d9d9d9")),
        ("FONTNAME", (0, 0), (-1, 0), "MalgunBd"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.6, colors.black),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    s.append(t1)
    s.append(Paragraph(
        "※ 위의 개인 정보 수집·이용에 대한 동의를 거부할 권리가 있습니다.<br/>"
        "&nbsp;&nbsp;&nbsp;그러나 동의를 거부할 경우, 원활한 서비스 제공에 "
        "일부 제한을 받을 수 있습니다.", SMALL))

    row1 = Table([[
        Paragraph(
            '<b>☞ 위와 같이 개인정보를 수집·이용하는데 동의하십니까?</b>',
            mk("r", 10, 14, TA_LEFT, 0, bold=True)),
        Paragraph(f'<para align="center">{cb(True)} 동의</para>',
                  mk("c1", 10, 14, TA_CENTER, 0, bold=True)),
        Paragraph(f'<para align="center">{cb(False)} 미동의</para>',
                  mk("c2", 10, 14, TA_CENTER, 0, bold=True))]],
        colWidths=[112 * mm, 29 * mm, 29 * mm])
    row1.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOX", (1, 0), (1, 0), 0.6, colors.black),
        ("BOX", (2, 0), (2, 0), 0.6, colors.black),
        ("BACKGROUND", (1, 0), (1, 0),
         colors.HexColor("#fff8d6")),
        ("ALIGN", (1, 0), (2, 0), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    s.append(row1)
    s.append(Spacer(1, 14))

    s.append(Paragraph(
        "<b>□ 제 3자 제공 내역</b>",
        mk("h", 11, 15, TA_LEFT, 4, bold=True)))
    t2 = Table([
        ["제공받는 자", "제공 목적", "제공 항목", "보유기간"],
        ["과학기술정보통신부,\n타 정부 부처,\n신용정보조회기관(기업)",
         "프로그램\n운영 자료\n활용",
         "수집·이용에 동의한 정보 중\n업무 목적 달성을 위해 필요한\n"
         "정보에 한함",
         "5년"]],
        colWidths=[42 * mm, 32 * mm, 68 * mm, 28 * mm])
    t2.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Malgun"),
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("BACKGROUND", (0, 0), (-1, 0),
         colors.HexColor("#d9d9d9")),
        ("FONTNAME", (0, 0), (-1, 0), "MalgunBd"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.6, colors.black),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    s.append(t2)
    s.append(Paragraph(
        "※ 위의 개인 정보 수집·이용에 대한 동의를 거부할 권리가 있습니다.<br/>"
        "&nbsp;&nbsp;&nbsp;그러나 동의를 거부 할 경우 원활한 서비스 제공에 "
        "일부 제한을 받을 수 있습니다.", SMALL))

    row2 = Table([[
        Paragraph(
            '<b>☞ 위와 같이 개인정보를 수집·이용하는데 동의하십니까?</b>',
            mk("r", 10, 14, TA_LEFT, 0, bold=True)),
        Paragraph(f'<para align="center">{cb(True)} 동의</para>',
                  mk("c1", 10, 14, TA_CENTER, 0, bold=True)),
        Paragraph(f'<para align="center">{cb(False)} 미동의</para>',
                  mk("c2", 10, 14, TA_CENTER, 0, bold=True))]],
        colWidths=[112 * mm, 29 * mm, 29 * mm])
    row2.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOX", (1, 0), (1, 0), 0.6, colors.black),
        ("BOX", (2, 0), (2, 0), 0.6, colors.black),
        ("BACKGROUND", (1, 0), (1, 0),
         colors.HexColor("#fff8d6")),
        ("ALIGN", (1, 0), (2, 0), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    s.append(row2)

    s.append(PageBreak())

    # 서명
    s.append(Spacer(1, 90))
    s.append(Paragraph(
        '<para align="center"><font size="14"><b>2026 년    6 월    13 일'
        '</b></font></para>',
        mk("d", 14, 22, TA_CENTER, 30, bold=True)))
    s.append(Spacer(1, 20))
    s.append(Paragraph(
        '<para align="center"><font size="14"><b>성  명 :    김 지 혁  '
        '          (서명 또는 인)</b></font></para>',
        mk("sg", 14, 22, TA_CENTER, 0, bold=True)))

    s.append(PageBreak())

    # [붙임2] 헤더
    s.append(Paragraph("<b>[붙임2]</b>",
                       mk("p", 11, 14, TA_LEFT, 6, bold=True)))
    bx = Table([[Paragraph(
        '<para align="center"><font size="18">'
        '<font color="red">(필수)</font> 신청인 이력서</font></para>',
        mk("ttl", 18, 24, TA_CENTER, 0))]],
        colWidths=[170 * mm], rowHeights=[14 * mm])
    bx.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1),
         colors.HexColor("#d9d9d9")),
        ("BOX", (0, 0), (-1, -1), 0.6, colors.black),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    s.append(bx)

    s.append(PageBreak())

    # 이력서 본문
    s.append(Paragraph(
        '<b>1) 기본 정보</b>',
        mk("h1", 11.5, 15, TA_LEFT, 4, bold=True)))
    info = Table([
        ["이름", "김지혁 (Jihyeok Kim, 영문 닉네임 Kevin)"],
        ["연락처", "010-8630-8016"],
        ["이메일", "kjh0209@kaist.ac.kr"],
        ["학교 / 전공", "KAIST 기술경영학부 / 전산학부 2학년 재학"],
        ["Github", "https://github.com/kjh0209"],
        ["LinkedIn",
         "https://www.linkedin.com/in/jihyeok-kim-4bb298287"],
    ], colWidths=[38 * mm, 132 * mm])
    info.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Malgun"),
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#eef2fb")),
        ("FONTNAME", (0, 0), (0, -1), "MalgunBd"),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#7388b5")),
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#7388b5")),
        ("LEFTPADDING", (1, 0), (1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    s.append(info)
    s.append(Spacer(1, 6))

    s.append(Paragraph(
        '<b>2) 한 줄 프로필</b>',
        mk("h2", 11.5, 15, TA_LEFT, 4, bold=True)))
    s.append(Paragraph(
        "AI-native 제품 기획·개발 경험과 스타트업 리서치 경험을 바탕으로, "
        "<b>GESS KAIST 2026에서 본인이 직접 떠올린 CUPID 아이디어로 현재 같은 "
        "팀의 CEO(대표) 역할을 맡고 있으며, GESS 활동 종료 후 1인 또는 1~2명의 "
        "합류 멤버와 함께 동일 아이템으로 법인 창업까지 이어 가려는 예비창업 "
        "단계의 학생 창업가</b>.", BODY))

    s.append(Paragraph(
        '<b>3) 주요 경험 및 활동 내역</b>',
        mk("h3", 11.5, 15, TA_LEFT, 4, bold=True)))
    activities = [
        ("<b>GESS KAIST  (2026.03 ~ 진행중)  ★ 본 신청서의 핵심 배경</b>",
         ["한국·미국에서 진행되는 KAIST 기업가정신 함양 프로그램.",
          "외국인 팀원과 함께 예비 창업팀 CUPID를 결성, 현재 본인이 "
          "<b>CEO(대표)</b> 역할을 수행 중.",
          "'AI 코딩 도구의 비용 부담 문제'에서 출발해 task별 최적 모델을 "
          "자동 라우팅하는 IDE 기반 서비스 CUPID를 기획·개발.",
          "2026.06.28 ~ 07.08 실리콘밸리 멘토링·기업 방문 일정 확정.",
          "본 OverEdge 신청 아이디어는 GESS 기간 중 <b>본인이 직접 떠올려 "
          "발전시킨 아이템</b>이며, GESS 종료 후에도 본인의 메인 프로젝트로 "
          "이어 가 <b>법인 창업까지 추진할 계획</b>."]),
        ("<b>Google I/O 2026 Student Ambassador (한국 대표 4인 중 1인)  "
         "(2026.03 ~ 2026.06)</b>",
         ["CA 마운틴뷰 Google I/O 현장 참여, 키노트·AI 서비스 발표 조사.",
          "Google AI subscription 총괄 PM 등 다수의 구글러와 인터뷰.",
          "미국·인도·일본 학생 대표들과 네트워킹, 내부 해커톤 참가."]),
        ("<b>E*5 KAIST  (2026.03 ~ 2026.05), 팀 viral plane, 본선 진출</b>",
         ["1인/소규모 창업가용 숏폼 마케팅 올인원 서비스 기획.",
          "블루포인트파트너스·한국투자증권·카카오벤처스 등 VC 멘토링."]),
        ("<b>카카오 AI 육성 프로젝트  (2025.12 ~ 2026.01), 팀 ANCHOR, "
         "본선 진출</b>",
         ["택시 기사 휴대폰 촬영 주행 화면을 CV 기반 AI가 분석해 기사-승객 "
          "합류를 돕는 서비스 기획·개발."]),
        ("<b>교내 동아리: SPARCS · Include · KE  (2025.03 ~ 진행중)</b>",
         ["SPARCS: 수강신청·시간표 서비스 OTL 백엔드 개발자(NestJS, Prisma, "
          "MariaDB, Docker).",
          "Include: AI 동아리. 논문 세미나, 딥페이크 판별 모델, RAG 기반 금융 "
          "어시스턴트 구현.",
          "KE: 창업 동아리. 스타트업 런칭·시장 리서치 방법 학습."]),
        ("<b>STDev 사이언스 해커톤 2026, 3등 수상</b>",
         ["수학 공식 기반 퍼즐 게임 Mathle(Math+Wordle) 개발."]),
    ]
    for title, bullets in activities:
        s.append(Paragraph("• " + title, BODYS))
        for b in bullets:
            s.append(Paragraph(
                "&nbsp;&nbsp;&nbsp;&nbsp;- " + b, BODYS))

    s.append(Paragraph(
        '<b>4) Skills</b>',
        mk("h4", 11.5, 15, TA_LEFT, 4, bold=True)))
    for line in [
        "<b>Research</b>: Startup research, competitor analysis, customer "
        "discovery, market trend analysis, report writing",
        "<b>AI / Coding Tools</b>: Claude Code, ChatGPT, Gemini, OpenAI/"
        "Anthropic/Google AI API, Vibe coding, LLM-assisted debugging",
        "<b>Development</b>: TypeScript, Python, NestJS, Prisma, MySQL/"
        "MariaDB, Docker, Git",
        "<b>Languages</b>: Korean (Native), English (Fluent, research/"
        "business)",
    ]:
        s.append(Paragraph("• " + line, BODYS))

    s.append(Paragraph(
        '<b>5) OverEdge 지원 동기</b>',
        mk("h5", 11.5, 15, TA_LEFT, 4, bold=True)))
    s.append(Paragraph(
        "CUPID 아이디어는 <b>GESS KAIST 프로그램을 진행하던 중 본인이 직접 "
        "떠올려 다듬어 온 아이템</b>이며, 현재 같은 프로그램의 예비창업팀에서 "
        "<b>CEO(대표)</b>를 맡고 있습니다. 이미 5단 파이프라인 기반의 MVP와 "
        "실측 절감 데이터(brick-out 게임 요청 기준 94.5% cost saving)까지 확보 "
        "한 상태입니다. OverEdge에서는 이 아이디어를 본인 단독 또는 KAIST 내 "
        "1~2명의 합류 멤버와 함께 다듬어, <b>GESS 종료 직후 곧바로 법인 창업 "
        "단계로 넘어가는 것</b>을 목표로 합니다.", BODY))

    s.append(PageBreak())

    # [붙임3] 헤더
    s.append(Paragraph("<b>[붙임3]</b>",
                       mk("p", 11, 14, TA_LEFT, 6, bold=True)))
    bx = Table([[Paragraph(
        '<para align="center"><font size="18">'
        '(선택) 기타 증빙서류</font></para>',
        mk("ttl", 18, 24, TA_CENTER, 0))]],
        colWidths=[170 * mm], rowHeights=[14 * mm])
    bx.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1),
         colors.HexColor("#d9d9d9")),
        ("BOX", (0, 0), (-1, -1), 0.6, colors.black),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    s.append(bx)

    s.append(PageBreak())

    s.append(Paragraph(
        "본 신청서에서 대표 이력 증빙으로 함께 제출하는 자료 목록입니다.",
        mk("p", 10.5, 15, TA_LEFT, 6)))
    items = [
        ("GESS KAIST 2026 Letter of Acceptance",
         "본 신청서의 핵심 배경인 CUPID 아이디어가 GESS KAIST 프로그램에서 "
         "<b>본인 주도로 시작·발전</b>되고 있음을 증빙. ※ 별도 첨부 파일로 "
         "함께 제출."),
        ("Google I/O 2026 Student Ambassador (한국 대표 4인 중 1인)",
         "글로벌 AI 트렌드 직접 조사 및 영문 기술 커뮤니케이션 역량 증빙."),
        ("STDev 사이언스 해커톤 2026, 3등 수상 (Mathle)",
         "AI·소프트웨어 구현 역량 증빙."),
        ("E*5 KAIST 2026 본선 진출, 팀 viral plane",
         "교내 창업경진대회 본선 진출. 스타트업 가설 검증·고객 인터뷰·VC "
         "멘토링 경험 증빙."),
        ("카카오 AI 육성 프로젝트 본선 진출, 팀 ANCHOR",
         "카카오 AI 학부생 육성 프로젝트 본선 진출. AI 서비스 기획·개발 "
         "역량 증빙."),
        ("4대 과학기술원 창업리그 GRAVITY 2026 참가, 팀 CUPID (CEO)",
         "본 OverEdge 신청 아이디어와 <b>동일한 CUPID 아이템</b>으로 4대 과학"
         "기술원 창업리그에 참가신청. 같은 아이디어가 <b>본인 주도로 다양한 "
         "외부 프로그램에서 검증</b>을 받고 있음을 증빙."),
    ]
    rows = [[Paragraph("<b>No.</b>", BODYS),
             Paragraph("<b>증빙 항목</b>", BODYS),
             Paragraph("<b>설명</b>", BODYS)]]
    for i, (title, desc) in enumerate(items, 1):
        rows.append([Paragraph(str(i), BODYS),
                     Paragraph(title, BODYS),
                     Paragraph(desc, BODYS)])
    tbl = Table(rows, colWidths=[10 * mm, 60 * mm, 100 * mm])
    tbl.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Malgun"),
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#d9d9d9")),
        ("FONTNAME", (0, 0), (-1, 0), "MalgunBd"),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.black),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    s.append(tbl)
    s.append(Spacer(1, 10))
    s.append(Paragraph(
        "※ GESS KAIST 2026 Letter of Acceptance는 본 신청 PDF 외부의 별도 "
        "파일로 함께 제출됩니다.", SMALL))

    doc.build(s)


if __name__ == "__main__":
    p1 = os.path.join(
        BASE_DIR, "KAIST OverEdge 창업 아이디어 기술서_김지혁.pdf")
    p2 = os.path.join(BASE_DIR, "KAIST OverEdge 증빙서류_김지혁.pdf")
    build_attach1(p1)
    print("[OK]", p1)
    build_attach2(p2)
    print("[OK]", p2)
