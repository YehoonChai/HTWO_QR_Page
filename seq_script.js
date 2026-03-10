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
	//    - sequenceTl: 이미지 프레임(시퀀스)만 담당
	//    - textTl: 텍스트 페이딩만 담당 (독립적인 duration 적용)
	const sequenceTl = gsap.timeline({ paused: true });
	const textTl = gsap.timeline({ paused: true });

	// ===== 이미지 시퀀스 타임라인 =====
	sequenceTl
		// 1단계: 프레임 0~33까지 자연스럽게 진행
		.to(sequence, {
			frame: 33,
			snap: "frame",
			ease: "none",
			onUpdate: render,
			duration: 0.1,
		})
		.addLabel("stage1")
		// 2단계: 프레임 33~56 이동
		.to(sequence, {
			frame: 56,
			snap: "frame",
			ease: "none",
			onUpdate: render,
			duration: 0.03,
		})
		.addLabel("stage2")
		// 3단계: 프레임 56~184까지 긴 이동
		.to(sequence, {
			frame: 184,
			snap: "frame",
			ease: "none",
			onUpdate: render,
			duration: 25,
		})
		.addLabel("stage3");

	// ===== 텍스트 타임라인 =====
	textTl
		// stage1: text1 등장 → 사라짐
		.to(".sequence-text1", {
			opacity: 1,
			duration: 0.7,
			ease: "power2.out",
		})
		.addLabel("stage1")
		.to(".sequence-text1", {
			opacity: 0,
			duration: 0.25,
			ease: "power2.in",
		})
		// stage2: text2 등장 → 사라짐
		.to(".sequence-text2", {
			opacity: 1,
			duration: 0.7,
			ease: "power2.out",
		})
		.addLabel("stage2")
		.to(".sequence-text2", {
			opacity: 0,
			duration: 0.35,
			ease: "power2.in",
		})
		// stage3: text3 등장 (유지)
		.to(".sequence-text3", {
			opacity: 1,
			duration: 3,
			ease: "power2.out",
		})
		.addLabel("stage3");

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

	// 텍스트: 이탈 시 빠르게 fade-out, 33/56/184 도착 직전에만 빠르게 fade-in (그 사이는 공백)
	const TEXT_FADE_OUT_DUR = 0.12;
	const TEXT_FADE_IN_DUR = 0.4; // 도착 직전 페이드인 시간
	const TEXT_FADE_IN_LEAD = 0.15; // 이미지 정지 N초 전에 페이드인 완료
	const TEXT_FADE_IN_DUR_184 = 0.5; // 184 도착 직전 페이드인 시간
	const TEXT_FADE_IN_LEAD_184 = 0.01; // 이미지 정지 N초 전에 페이드인 완료
	const TEXT_FADE_IN_DELAY_184 = 0.35; // 텍스트3 추가 지연 (클수록 더 늦게 나타남)
	// textTl 내부 세그먼트 길이 (playhead seek용, 위 타임라인 .to duration과 일치)
	const TEXT_TL_TEXT1_OUT = 0.25;
	const TEXT_TL_TEXT2_OUT = 0.35;

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
		// 다음 페이지로 이동 시작 시 .rain-text 페이드아웃, 페이지1 복귀 시 갭 뒤 페이드인
		const rainText = document.querySelector(".rain-text");
		const RAIN_TEXT_FADE_IN_DELAY = 0.5; // 사라진 뒤 다시 나타나기 전 대기(초). 갭 조절
		if (rainText) {
			if (seqSectionInView && !prevSeqSectionInView) {
				gsap.to(rainText, { opacity: 0, duration: 0.12, ease: "power2.in" });
			} else if (!seqSectionInView && prevSeqSectionInView) {
				gsap.to(rainText, {
					opacity: 1,
					duration: 0.35,
					delay: RAIN_TEXT_FADE_IN_DELAY,
					ease: "power2.out",
				});
			}
		}
		// 000이면 일반 스크롤 허용(pan-y), 그 외 시퀀스 구간에서는 터치 가로채기(none)
		applySeqTouchAction();
		// 페이지3에서 페이지2로 돌아왔을 때: 마지막 이미지(184)+텍스트3 떠 있는 상태로 역방향 준비
		if (
			seqSectionInView &&
			!prevSeqSectionInView &&
			sequence.frame >= frameCount - 1
		) {
			sequenceTl.seek("stage3");
			textTl.seek("stage3");
			gsap.set(".sequence-text1", { opacity: 0 });
			gsap.set(".sequence-text2", { opacity: 0 });
			gsap.set(".sequence-text3", { opacity: 1 });
			render();
		}
		// 2페이지에 막 도착했을 때 → 자동으로 33(stage1)까지. 33 도착 직전에 텍스트1 빠르게 페이드인
		if (seqSectionInView && !prevSeqSectionInView && sequence.frame < 1) {
			isStageAnimating = true;
			const imgDuration = 0.9;
			const tDelay = Math.max(
				0,
				imgDuration - TEXT_FADE_IN_LEAD - TEXT_FADE_IN_DUR,
			);
			sequenceTl.tweenTo("stage1", {
				ease: "none",
				duration: imgDuration,
				onComplete: () => {
					isStageAnimating = false;
				},
			});
			textTl.tweenTo("stage1", {
				ease: "power1.out",
				duration: TEXT_FADE_IN_DUR,
				delay: tDelay,
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
		const next = sequenceTl.nextLabel();
		if (!next) return;
		const current = sequenceTl.currentLabel();

		// 이탈 시 현재 텍스트 빠르게 페이드아웃 (33→56, 56→184, 184→페이지3 모두)
		if (current === "stage1")
			gsap.to(".sequence-text1", {
				opacity: 0,
				duration: TEXT_FADE_OUT_DUR,
				ease: "power2.in",
			});
		else if (current === "stage2")
			gsap.to(".sequence-text2", {
				opacity: 0,
				duration: TEXT_FADE_OUT_DUR,
				ease: "power2.in",
			});
		else if (current === "stage3")
			gsap.to(".sequence-text3", {
				opacity: 0,
				duration: TEXT_FADE_OUT_DUR,
				ease: "power2.in",
			});

		// 000→33(stage1)은 스크롤로 다시 올라왔을 때도 빠르게
		const imgDuration =
			next === "stage1"
				? 1.2
				: current === "stage2" && next === "stage3"
					? 4
					: current === "stage1" && next === "stage2"
						? 1
						: 3.5;
		// 33/56/184 도착 직전에만 빠르게 페이드인 (그 전까지는 공백)
		const isTo184 = next === "stage3";
		const tInDur = isTo184 ? TEXT_FADE_IN_DUR_184 : TEXT_FADE_IN_DUR;
		const tInLead = isTo184 ? TEXT_FADE_IN_LEAD_184 : TEXT_FADE_IN_LEAD;
		const textDelay =
			Math.max(0, imgDuration - tInLead - tInDur) +
			(isTo184 ? TEXT_FADE_IN_DELAY_184 : 0);

		// tweenTo 시 이전 텍스트가 다시 보이지 않도록: 재생헤드를 "이전 텍스트 이미 0" 위치로
		if (next === "stage2")
			textTl.time(textTl.labels.stage1 + TEXT_TL_TEXT1_OUT);
		else if (next === "stage3")
			textTl.time(textTl.labels.stage2 + TEXT_TL_TEXT2_OUT);

		isStageAnimating = true;

		sequenceTl.tweenTo(next, {
			ease: "none",
			duration: imgDuration,
			onComplete: () => {
				isStageAnimating = false;
				if (next === "stage3") applySeqTouchAction();
			},
		});

		textTl.tweenTo(next, {
			ease: "power1.out",
			duration: tInDur,
			delay: textDelay,
		});
	}

	function goToPrevStage() {
		if (isStageAnimating) return;
		const prev = sequenceTl.previousLabel();
		const current = sequenceTl.currentLabel();
		// 이탈 시 현재 텍스트 빠르게 페이드아웃
		if (current === "stage1")
			gsap.to(".sequence-text1", {
				opacity: 0,
				duration: TEXT_FADE_OUT_DUR,
				ease: "power2.in",
			});
		else if (current === "stage2")
			gsap.to(".sequence-text2", {
				opacity: 0,
				duration: TEXT_FADE_OUT_DUR,
				ease: "power2.in",
			});
		else if (current === "stage3")
			gsap.to(".sequence-text3", {
				opacity: 0,
				duration: TEXT_FADE_OUT_DUR,
				ease: "power2.in",
			});

		if (prev) {
			// 184→56: 4초, 56→33: 더 빠르게 1.2초
			const imgDuration = current === "stage3" && prev === "stage2" ? 4 : 1.2;
			// 56 또는 33 도착 직전에만 텍스트 빠르게 페이드인
			const tDelay = Math.max(
				0,
				imgDuration - TEXT_FADE_IN_LEAD - TEXT_FADE_IN_DUR,
			);
			// 역방향도 재생헤드를 "도착할 텍스트만 나오는" 시작점으로 (따닥 방지)
			if (prev === "stage1")
				textTl.time(textTl.labels.stage1 + TEXT_TL_TEXT1_OUT);
			else if (prev === "stage2")
				textTl.time(textTl.labels.stage2 + TEXT_TL_TEXT2_OUT);
			isStageAnimating = true;
			sequenceTl.tweenTo(prev, {
				ease: "none",
				duration: imgDuration,
				onComplete: () => {
					isStageAnimating = false;
				},
			});
			textTl.tweenTo(prev, {
				ease: "power1.out",
				duration: TEXT_FADE_IN_DUR,
				delay: tDelay,
			});
		} else {
			// 33 → 000: 텍스트 없음, 이미지 더 빠르게 1.5초
			const imgDuration = 1.5;
			isStageAnimating = true;
			sequenceTl.tweenTo(0, {
				ease: "none",
				duration: imgDuration,
				onComplete: () => {
					isStageAnimating = false;
					applySeqTouchAction();
				},
			});
			textTl.tweenTo(0, { ease: "power1.in", duration: 0.3 });
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
			if (isSequenceComplete()) {
				gsap.to(".sequence-text3", {
					opacity: 0,
					duration: TEXT_FADE_OUT_DUR,
					ease: "power2.in",
				});
				return; // 끝났으면 prevent 안 함 → 일반 스크롤로 섹션3로
			}
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
				gsap.to(".sequence-text3", {
					opacity: 0,
					duration: TEXT_FADE_OUT_DUR,
					ease: "power2.in",
				});
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
