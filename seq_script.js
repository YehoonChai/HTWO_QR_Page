const sequenceCanvas = document.getElementById("sequence-canvas");
const context = sequenceCanvas ? sequenceCanvas.getContext("2d") : null;

// 1. 설정값
const frameCount = 185; // 000부터 184까지 총 185장
const currentFrame = (index) =>
	`./Images/frame_${index.toString().padStart(3, "0")}.png`;

// 2. 이미지 미리 로드 (성능 최적화)
const images = [];
const sequence = {
	frame: 0,
};

for (let i = 0; i < frameCount; i++) {
	const img = new Image();
	img.src = currentFrame(i);
	images.push(img);
}

// 3. GSAP 애니메이션
gsap.registerPlugin(ScrollTrigger, Observer);

images[0].onload = () => {
	render();

	// 1. 타임라인 생성 (자동 이동을 위해 paused: true)
	const tl = gsap.timeline({ paused: true });

	tl
		// 1단계: 프레임 0~33까지 자연스럽게진행
		.to(sequence, {
			frame: 33, // 0~33 프레임까지
			snap: "frame",
			ease: "none",
			onUpdate: render,
			duration: 0.015, // 구간의 길이(초) - 커스텀 가능
		})
		// 1단계 텍스트 노출
		.to(".sequence-text1", {
			opacity: 1,
			duration: 0.05, // 나타나는 시간(초)
		})
		.addLabel("stage1") // stage1 구간 레이블(자동진행 or 직접 호출 시 활용)
		// 1단계 텍스트 사라짐
		.to(".sequence-text1", {
			opacity: 0,
			duration: 0.03, // 사라지는 시간(초)
		})
		// 2단계: 프레임 33~56 이동
		.to(sequence, {
			frame: 56,
			snap: "frame",
			ease: "none",
			onUpdate: render,
			duration: 0.03,
		})
		// 2단계 텍스트 노출
		.to(".sequence-text2", {
			opacity: 1,
			duration: 0.1,
		})
		.addLabel("stage2") // stage2 (커스텀시 이름 변경 가능)
		// 2단계 텍스트 사라짐
		.to(".sequence-text2", {
			opacity: 0,
			duration: 2,
		})
		// 3단계: 나머지 프레임(56~184)까지 긴 이동
		.to(sequence, {
			frame: 184,
			snap: "frame",
			ease: "none",
			onUpdate: render,
			duration: 25, // (커스텀!) 길게 잡으면 천천히 진행
		})
		// 3단계 텍스트 부드럽게 노출 - 천천히 등장(느리게)
		.to(".sequence-text3", {
			opacity: 1,
			duration: 3, // 기존 0.5에서 2초로 천천히 등장시킴
			ease: "power2.out",
		})
		.addLabel("stage3"); // stage3 (필요시 레이블명 추가)

	// 2. 2페이지가 뷰포트를 채울 때만 스크롤을 가로채서 시퀀스 제어. 그 외에는 일반 스크롤.
	const seqSection = document.getElementById("seq-section");
	let seqSectionInView = false;
	let prevSeqSectionInView = false;
	let isStageAnimating = false;
	const WHEEL_THRESH = 8; // 휠 민감도 (낮을수록 작은 스크롤에도 반응)
	const TOUCH_THRESH = 18; // 터치 한 번에 한 단계씩
	// 페이지2 도달 전: 일반 스크롤. 도달 후: 이미지 시퀀스.
	const ENTER_SLOP = 25; // 2페이지가 화면 대부분 채우면 시퀀스 모드 진입 (너무 엄격하면 진입 안 함)
	const EXIT_TOP = 70;
	const EXIT_BOTTOM = 70;

	function updateSeqSectionInView() {
		if (!seqSection) return;
		const r = seqSection.getBoundingClientRect();
		const H = window.innerHeight;
		prevSeqSectionInView = seqSectionInView;
		if (!seqSectionInView) {
			seqSectionInView = r.top <= ENTER_SLOP && r.bottom >= H - ENTER_SLOP;
		} else {
			seqSectionInView = !(r.top > EXIT_TOP || r.bottom < H - EXIT_BOTTOM);
		}
		// 000이면 일반 스크롤 허용(pan-y), 그 외 시퀀스 구간에서는 터치 가로채기(none)
		applySeqTouchAction();
		// 2페이지에 막 도착했을 때 → 자동으로 33프레임(stage1)까지 진행
		if (seqSectionInView && !prevSeqSectionInView && sequence.frame < 1) {
			isStageAnimating = true;
			tl.tweenTo("stage1", {
				ease: "none",
				duration: 3.5,
				onComplete: () => {
					isStageAnimating = false;
				},
			});
		}
	}

	window.addEventListener("scroll", updateSeqSectionInView, { passive: true });
	window.addEventListener("resize", updateSeqSectionInView);
	const io = new IntersectionObserver(
		(entries) => {
			if (entries[0].isIntersecting) updateSeqSectionInView();
		},
		{ threshold: 0.1 },
	);
	if (seqSection) {
		io.observe(seqSection);
		updateSeqSectionInView();
		applySeqTouchAction();
	}

	function goToNextStage() {
		if (isStageAnimating) return;
		const next = tl.nextLabel();
		if (!next) return;
		const current = tl.currentLabel();
		const duration = current === "stage2" && next === "stage3" ? 7 : 3.5;
		isStageAnimating = true;
		tl.tweenTo(next, {
			ease: "none",
			duration,
			onComplete: () => {
				isStageAnimating = false;
				if (next === "stage3") applySeqTouchAction();
			},
		});
	}

	function goToPrevStage() {
		if (isStageAnimating) return;
		const prev = tl.previousLabel();
		if (prev) {
			const current = tl.currentLabel();
			const duration = current === "stage3" && prev === "stage2" ? 4 : 2;
			isStageAnimating = true;
			tl.tweenTo(prev, {
				ease: "none",
				duration,
				onComplete: () => {
					isStageAnimating = false;
				},
			});
		} else {
			isStageAnimating = true;
			tl.tweenTo(0, {
				ease: "none",
				duration: 2.5,
				onComplete: () => {
					isStageAnimating = false;
					applySeqTouchAction();
				},
			});
		}
	}

	// 000이면 터치로 일반 스크롤(pan-y). 그 외(시퀀스 진행 중·완료 모두) 시퀀스 제어(none) → 역방향/아래쪽 스크롤은 JS로 처리.
	function applySeqTouchAction() {
		if (!seqSection) return;
		const container = seqSection.querySelector(".canvas-container");
		const captureScroll = seqSectionInView && !isAtFrameZero();
		const ta = captureScroll ? "none" : "pan-y";
		seqSection.style.touchAction = ta;
		if (container) container.style.touchAction = ta;
	}

	// 000인지 판단: progress가 아니라 실제 프레임으로 (stage1도 progress가 작아서 0.02 미만일 수 있음)
	function isAtFrameZero() {
		return sequence.frame < 1;
	}

	// 이미지 시퀀싱이 끝까지 완료되었는지 (끝나면 아래로 일반 스크롤 → 섹션3으로)
	function isSequenceComplete() {
		return sequence.frame >= frameCount - 1;
	}

	// 휠: 시퀀스 구간. 시퀀스 완료 후 아래 스크롤은 일반 스크롤로 섹션3 이동.
	function onWheel(e) {
		if (!seqSectionInView) return;
		const dy = e.deltaY;
		if (dy > WHEEL_THRESH) {
			if (isSequenceComplete()) return; // 끝났으면 prevent 안 함 → 일반 스크롤로 섹션3로
			e.preventDefault();
			goToNextStage();
		} else if (dy < -WHEEL_THRESH) {
			if (isAtFrameZero()) return; // 000이면 prevent 안 함 → 일반 스크롤로 섹션1
			e.preventDefault();
			goToPrevStage(); // 역방향 시퀀스
		}
	}

	// 터치: 000이 아닐 때는 touchstart에서부터 막아서 브라우저가 스크롤을 시작하지 못하게 함 (Intervention 오류 방지)
	let touchStartY = 0;
	let cumulativeTouch = 0;

	function onTouchStart(e) {
		touchStartY = e.touches[0].clientY;
		cumulativeTouch = 0;
		// 시퀀스 구간이고 000이 아닐 때 항상 터치 가로채기 → 역방향 시퀀스 가능, Intervention 방지
		if (seqSectionInView && !isAtFrameZero()) {
			e.preventDefault();
		}
	}

	function onTouchMove(e) {
		if (!seqSectionInView) return;
		const y = e.touches[0].clientY;
		const delta = touchStartY - y;
		touchStartY = y;
		cumulativeTouch += delta;

		if (cumulativeTouch > TOUCH_THRESH) {
			cumulativeTouch = 0;
			if (isSequenceComplete()) {
				e.preventDefault();
				const bubble = document.getElementById("bubble-section");
				if (bubble)
					window.scrollTo({ top: bubble.offsetTop, behavior: "smooth" });
				return;
			}
			e.preventDefault();
			goToNextStage();
		} else if (cumulativeTouch < -TOUCH_THRESH) {
			cumulativeTouch = 0;
			if (isAtFrameZero()) {
				e.preventDefault();
				window.scrollTo({ top: 0, behavior: "smooth" });
				return;
			}
			e.preventDefault();
			goToPrevStage(); // 역방향 시퀀스
		}
	}

	document.addEventListener("wheel", onWheel, { passive: false });
	document.addEventListener("touchstart", onTouchStart, { passive: false });
	document.addEventListener("touchmove", onTouchMove, { passive: false });
};

// 4. 캔버스에 이미지 그리기 함수 (섹션 컨테이너 크기에 맞춤)
function render() {
	const img = images[sequence.frame];
	if (!img || !img.complete || !img.naturalWidth) return;

	// 시퀀스 섹션 컨테이너 크기 사용 (스크롤 아래 섹션에 맞춤)
	if (!sequenceCanvas || !context) return;
	const container = sequenceCanvas.parentElement;
	const canvasWidth = container ? container.clientWidth : window.innerWidth;
	const canvasHeight = container ? container.clientHeight : window.innerHeight;
	if (canvasWidth <= 0 || canvasHeight <= 0) return;

	sequenceCanvas.width = canvasWidth;
	sequenceCanvas.height = canvasHeight;

	// 이미지 비율 유지하며 꽉 채우기 (cover)
	const hRatio = canvasWidth / img.width;
	const vRatio = canvasHeight / img.height;
	const ratio = Math.max(hRatio, vRatio);
	const drawWidth = img.width * ratio;
	const drawHeight = img.height * ratio;
	const offsetX = (canvasWidth - drawWidth) / 2;
	const offsetY = (canvasHeight - drawHeight) / 2;

	context.clearRect(0, 0, canvasWidth, canvasHeight);
	context.drawImage(
		img,
		0,
		0,
		img.width,
		img.height,
		offsetX,
		offsetY,
		drawWidth,
		drawHeight,
	);
}

// 리사이즈 시 현재 프레임 다시 그리기
window.addEventListener("resize", render);

// 스크롤해서 시퀀스 섹션이 보일 때 한 번 더 그리기 (컨테이너 크기 적용)
const seqSection = document.getElementById("seq-section");
if (seqSection) {
	const io = new IntersectionObserver(
		(entries) => {
			if (entries[0].isIntersecting) render();
		},
		{ threshold: 0.1 },
	);
	io.observe(seqSection);
}
