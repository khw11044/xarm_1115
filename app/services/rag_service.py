from langchain.prompts import PromptTemplate
from langchain.schema.output_parser import StrOutputParser
from langchain_openai import ChatOpenAI
from langchain_community.chat_models import ChatOllama
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_community.chat_message_histories import ChatMessageHistory, SQLChatMessageHistory
from langchain.schema import HumanMessage
from langchain_community.retrievers import BM25Retriever
from langchain.chains import create_history_aware_retriever, create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain

from utils.template import order_prompt, contextualize_prompt
from langchain_core.runnables.utils import ConfigurableFieldSpec

config_fields = [
    ConfigurableFieldSpec(
        id="user_id",
        annotation=str,
        name="User ID",
        description="Unique identifier for a user.",
        default="",
        is_shared=True,
    )
]

from dotenv import load_dotenv
load_dotenv()

class RagPipeline:
    def __init__(self):
        self.llm = ChatOpenAI(model_name="gpt-4o-mini", temperature=0.1)
        # self.llm = ChatOllama(model="llama3.1", temperature=0.1)
        self.retriever = self.init_retriever()
        self.chain = self.init_chain()
        self.current_session_id = 'a000000'
        
    def init_retriever(self):            
        all_docs = ["아몬드", "시리얼", "코코볼"]
        bm25_retriever = BM25Retriever.from_texts(all_docs)
        bm25_retriever.k = 3                                            # BM25Retriever의 검색 결과 개수를 1로 설정합니다.
        return bm25_retriever

    def init_chain(self):
        # 1. 이어지는 대화가 되도록 대화기록과 체인
        history_aware_retriever = create_history_aware_retriever(self.llm, self.retriever, contextualize_prompt)      # self.mq_ensemble_retriever
        # 2. 문서들의 내용을 답변할 수 있도록 리트리버와 체인
        question_answer_chain = create_stuff_documents_chain(self.llm, order_prompt)
        # 3. 1과 2를 합침
        rag_chat_chain = create_retrieval_chain(history_aware_retriever, question_answer_chain)
        
        return rag_chat_chain


    def generate_answer(self, question: str, session_id=None):
        
        if session_id == None:
            session_id = self.current_session_id
        else:
            self.current_session_id = session_id
        
        print(f"[대화 세션ID]: {self.current_session_id }")
        
        # 세션 ID를 기반으로 세션 기록을 가져오는 함수
        def get_chat_history(session_id):
            return SQLChatMessageHistory(
                table_name='customer',
                session_id=session_id,
                connection="sqlite:///sqlite.db",
            )
        

        conversational_rag_chain = RunnableWithMessageHistory(      
            self.chain,                                 # 실행할 Runnable 객체
            get_chat_history,                        # 세션 기록을 가져오는 함수
            input_messages_key="input",                 # 입력 메시지의 키
            history_messages_key="chat_history",        # 기록 메시지의 키
            history_factory_config=config_fields,  # 대화 기록 조회시 참고할 파라미터를 설정합니다.
        )
        response = conversational_rag_chain.invoke(
            {"input": question},
            config={"configurable": {"user_id": self.current_session_id}}            # 같은 session_id 를 입력하면 이전 대화 스레드의 내용을 가져오기 때문에 이어서 대화가 가능!
        )
        
        return response
