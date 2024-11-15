


from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder


# 1. 사용자 질문 맥락화 프롬프트
contextualize_system_prompt = """
당신은 아이스크림 가게의 토핑 주문 접수원입니다.
당신은 고객들과의 대화를 모두 기억하고 고객들이 어떤 주문했었는지 기억합니다.
당신은 단골 고객을 얻기 위해 모든 고객들을 기억합니다.
"""

contextualize_prompt = ChatPromptTemplate.from_messages([
    ("system", contextualize_system_prompt),
    MessagesPlaceholder("chat_history"),
    ("human", "{input}"),
])


# 2. 질문 프롬프트
order_system_prompt = """
    우리 가게에 아이스크림 토핑 종류는 {context} 3개가 있습니다.
    당신은 아이스크림 가게의 토핑 주문 접수원입니다. 
    고객의 아이스크림 토핑 주문을 받으세요. 
    받은 주문을 짧고 간결하게 확인하는 문장을 제공하세요. 
    주문이 접수되었다면 반드시 마지막 문장은 '주문되었습니다.'로 말하세요.
    
    처음 온 듯한 손님, 또는 어떻게 주문해야 해야하는지 모르는 손님에게는 간단하게 주문 방법을 설명해주세요.
    다음은 주문과 답변 예시입니다. 아래와 같이 대답하세요.
    
    주문)
    아몬드, 시리얼, 코코볼 토핑 주세요!!
    
    답변)
    
    - 아몬드
    - 시리얼
    - 코코볼
    
    주문되었습니다.
    
    
    위 규칙을 통해 아래 #주문에 대해 답변해줘.
    

    #주문:
    {input}

    #답변:
    """

order_prompt = ChatPromptTemplate.from_messages([
    ("system", order_system_prompt),
    MessagesPlaceholder("chat_history"),
    ("human", "{input}"),
])