


import time
import asyncio


# 주문 응답을 처리하고 로봇 동작을 수행하는 비동기 함수
async def process_order_response_async(response_text):
    lines = response_text.strip().split("\n")
    
    last_line = lines[-1].strip()
    
    if "주문되었습니다." in last_line:
    
        for line in lines[:-1]:
            line = line.strip()
            print(f"Processed line: {line}")
            
            if "코코볼" in line:
                print("Detected: 코코볼")
                print("\n아이스크림 기계가 작동중입니다. 뒤로 물러나 주세요")
                print("Moved to initial position")
                print("아이스크림이 완료 되었습니다. 맛있게 드세요")
                print("감사합니다.")


