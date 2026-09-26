const canvas = document.getElementById("gameCanvas");

const ctx = canvas.getContext("2d");



const scoreEl = document.getElementById("score");

const bestEl = document.getElementById("best");

const livesEl = document.getElementById("lives");



const overlay = document.getElementById("overlay");

const playBtn = document.getElementById("playBtn");

const menuTitle = document.getElementById("menuTitle");

const menuText = document.getElementById("menuText");



const pauseBtn = document.getElementById("pauseBtn");

const powerText = document.getElementById("powerText");



// =====================================================

// CANVAS

// =====================================================



const W = 1100;

const H = 650;



canvas.width = W;

canvas.height = H;





// =====================================================

// GAME STATE

// =====================================================



let running = false;

let paused = false;



let score = 0;

let lives = 3;

let combo = 0;



let best =

    Number(localStorage.getItem("brick_best_score")) || 0;



let gameTime = 0;



let brickDropTimer = 0;

let brickDropInterval = 8500;



let speedTimer = 0;



let shake = 0;



bestEl.textContent = best;





// =====================================================

// PADDLE

// =====================================================



const paddle = {



    x: W / 2 - 70,



    y: H - 50,



    width: 140,



    height: 14,



    baseWidth: 140,



    speed: 11,



    left: false,



    right: false,



    powerTimer: 0

};





// =====================================================

// BALL

// =====================================================



let balls = [];





function createBall(

    x = W / 2,

    y = H - 75,

    dx = 4.5,

    dy = -5.5

) {



    return {



        x,

        y,



        radius: 8,



        dx,

        dy,



        trail: []

    };

}





function resetBalls() {



    balls = [

        createBall()

    ];

}





// =====================================================

// BRICKS

// =====================================================



const brick = {



    rows: 7,



    cols: 11,



    width: 80,



    height: 25,



    gap: 8,



    top: 60

};



let bricks = [];
let nextRowId = 0;
let replacedRows = new Set();





const brickColors = [

    "#ff4662",

    "#ff8b35",

    "#ffc83d",

    "#35d77b",

    "#34b8ff",

    "#9a5cff"

];





// =====================================================

// TẠO GẠCH BAN ĐẦU

// =====================================================



function createInitialBricks() {



    bricks = [];
    nextRowId = 0;
    replacedRows = new Set();



    for (

        let row = 0;

        row < brick.rows;

        row++

    ) {



        const y =

            brick.top +

            row *

            (brick.height + brick.gap);



        addBrickRow(

            y,

            row

        );

    }



    // Gạch được tạo dày để game vào nhịp nhanh hơn

   // Nếu có lỗi random thì vẫn đảm bảo có gạch

    if (bricks.length === 0) {



        addBrickRow(

            brick.top,

            0

        );

    }

}





// =====================================================

// THÊM HÀNG GẠCH

// =====================================================



function addBrickRow(

    y,
    rowOffset = 0

) {

    const totalWidth =
        brick.cols * brick.width +
        (brick.cols - 1) * brick.gap;

    const startX =
        (W - totalWidth) / 2;

    // Mỗi lần tạo hàng sẽ có một ID riêng để
    // biết chính xác khi nào cả hàng đó đã bị phá.
    const rowId = nextRowId++;

    for (
        let col = 0;
        col < brick.cols;
        col++
    ) {

        // Bố cục ngẫu nhiên kiểu Brick Breaker:
        // nhiều khoảng trống để bóng có đường đi.
        // Một vài ô liền nhau tạo thành cụm gạch.
        const emptyChance =
            rowOffset <= 2
                ? 0.42
                : 0.34;

        if (
            Math.random() < emptyChance
        ) {
            continue;
        }

        bricks.push({

            x:
                startX +
                col * (brick.width + brick.gap),

            y,

            width: brick.width,

            height: brick.height,

            row:
                Math.abs(
                    rowOffset % brickColors.length
                ),

            rowId,

            col,

            alive: true,

            special:
                Math.random() < 0.07,

            hp:
                Math.random() < 0.10
                    ? 2
                    : 1
        });
    }
}


// =====================================================
// KIỂM TRA DÒNG NGANG / DỌC ĐÃ BỊ PHÁ HẾT
// =====================================================

function checkClearedLines(rowId, col) {

    // Không đẩy toàn bộ gạch xuống ngay khi clear.
    // Chỉ thưởng một hàng random mới ở phía trên.
    // Nhờ vậy sân vẫn thoáng và bóng luôn có đường chơi.

    const rowBricks = bricks.filter(
        b => b.rowId === rowId
    );

    const rowCleared =
        rowBricks.length >= 4 &&
        rowBricks.every(b => !b.alive);

    if (rowCleared) {

        for (const b of rowBricks) {
            b.rowId = -1;
        }

        spawnReplacementRow(false);
        return;
    }

    const colBricks = bricks.filter(
        b => b.col === col
    );

    const colCleared =
        colBricks.length >= 4 &&
        colBricks.every(b => !b.alive);

    if (colCleared) {

        for (const b of colBricks) {
            b.col = -1;
        }

        spawnReplacementRow(false);
    }
}


// =====================================================
// THÊM HÀNG RANDOM
// =====================================================

function spawnReplacementRow(pushDown = false) {

    const aliveBricks =
        bricks.filter(
            b => b.alive
        );

    // Chỉ các lần spawn theo nhịp game mới đẩy gạch xuống.
    // Clear hàng/cột không làm cả đống gạch lao xuống đáy.
    if (pushDown) {

        for (const b of aliveBricks) {
            b.y += 24;
        }
    }

    // Tìm vị trí hàng trên cùng.
    let minY = brick.top;

    if (aliveBricks.length > 0) {

        minY = Math.min(
            ...aliveBricks.map(
                b => b.y
            )
        );
    }

    // Hàng mới nằm phía trên cùng,
    // không chen vào giữa các cụm gạch.
    const newY =
        Math.min(
            brick.top,
            minY - brick.height - brick.gap
        );

    addBrickRow(
        newY,
        Math.floor(gameTime * 2)
    );

    // Particle nhẹ báo hàng mới.
    for (
        let i = 0;
        i < 30;
        i++
    ) {

        particles.push({

            x: Math.random() * W,

            y: Math.max(
                2,
                newY
            ),

            vx:
                (Math.random() - 0.5) * 2.5,

            vy:
                Math.random() * 3 + 1,

            size:
                Math.random() * 2 + 1,

            life: 1,

            decay: 0.035,

            color: "#42baff",

            rotation: 0,

            spin: 0
        });
    }

    shake = 3;
}

// =====================================================

// GẠCH HẠ XUỐNG

// =====================================================



function dropBricks() {

    // Mỗi nhịp chỉ hạ gạch một chút.
    // Không để các hàng dồn xuống quá nhanh.
    const amount = 24;

    for (const b of bricks) {

        if (!b.alive) {
            continue;
        }

        b.y += amount;
    }

    spawnReplacementRow(false);
}

// =====================================================

// PARTICLES

// =====================================================



let particles = [];





function explode(

    x,

    y,

    color,

    amount = 45

) {



    // Mảnh gạch



    for (

        let i = 0;

        i < amount;

        i++

    ) {



        const angle =

            Math.random() *

            Math.PI *

            2;



        const speed =

            3 +

            Math.random() * 8;





        particles.push({



            x,



            y,



            vx:

                Math.cos(angle) *

                speed,



            vy:

                Math.sin(angle) *

                speed,



            size:

                Math.random() *

                4 +

                1,



            life: 1,



            decay:

                0.018 +

                Math.random() *

                0.025,



            color,



            rotation:

                Math.random() *

                Math.PI,



            spin:

                (Math.random() - 0.5) *

                0.3

        });

    }





    // Hạt sáng nhỏ



    for (

        let i = 0;

        i < 30;

        i++

    ) {



        const angle =

            Math.random() *

            Math.PI *

            2;



        const speed =

            7 +

            Math.random() *

            11;





        particles.push({



            x,



            y,



            vx:

                Math.cos(angle) *

                speed,



            vy:

                Math.sin(angle) *

                speed,



            size:

                Math.random() *

                2 +

                0.5,



            life: 1,



            decay: 0.035,



            color: "#ffffff",



            rotation: 0,



            spin: 0

        });

    }



    shake = 9;

}





function updateParticles() {



    for (

        let i = particles.length - 1;

        i >= 0;

        i--

    ) {



        const p =

            particles[i];





        p.x += p.vx;

        p.y += p.vy;





        p.vx *= 0.985;

        p.vy *= 0.985;



        p.vy += 0.12;



        p.rotation += p.spin;



        p.life -= p.decay;





        if (

            p.life <= 0

        ) {



            particles.splice(

                i,

                1

            );

        }

    }

}





function drawParticles() {



    for (

        const p of particles

    ) {



        ctx.save();



        ctx.globalAlpha =

            Math.max(

                0,

                p.life

            );



        ctx.fillStyle =

            p.color;



        ctx.shadowBlur = 12;



        ctx.shadowColor =

            p.color;



        ctx.translate(

            p.x,

            p.y

        );



        ctx.rotate(

            p.rotation

        );



        ctx.fillRect(

            -p.size / 2,

            -p.size / 2,

            p.size,

            p.size

        );



        ctx.restore();

    }



    ctx.globalAlpha = 1;

}





// =====================================================

// SCORE POPUP

// =====================================================



let scorePopups = [];





function showScore(

    x,

    y,

    value

) {



    scorePopups.push({



        x,



        y,



        value,



        life: 1,



        vy: -2

    });

}





function updateScorePopups() {



    for (

        let i = scorePopups.length - 1;

        i >= 0;

        i--

    ) {



        const p =

            scorePopups[i];



        p.y += p.vy;



        p.life -= 0.025;





        if (

            p.life <= 0

        ) {



            scorePopups.splice(

                i,

                1

            );

        }

    }

}





function drawScorePopups() {



    for (

        const p of scorePopups

    ) {



        ctx.save();



        ctx.globalAlpha =

            p.life;



        ctx.fillStyle =

            "#ffffff";



        ctx.font =

            "bold 18px Arial";



        ctx.textAlign =

            "center";



        ctx.shadowBlur = 12;



        ctx.shadowColor =

            "#35baff";



        ctx.fillText(

            "+" + p.value,

            p.x,

            p.y

        );



        ctx.restore();

    }



    ctx.globalAlpha = 1;

}





// =====================================================

// BACKGROUND

// =====================================================



const stars = [];





for (

    let i = 0;

    i < 220;

    i++

) {



    stars.push({



        x:

            Math.random() * W,



        y:

            Math.random() * H,



        size:

            Math.random() * 2,



        speed:

            Math.random() *

            0.6 +

            0.1,



        alpha:

            Math.random() *

            0.7 +

            0.2

    });

}





function drawBackground() {



    const gradient =

        ctx.createRadialGradient(

            W / 2,

            H / 2,

            20,

            W / 2,

            H / 2,

            W

        );





    gradient.addColorStop(

        0,

        "#101e3c"

    );



    gradient.addColorStop(

        0.5,

        "#071024"

    );



    gradient.addColorStop(

        1,

        "#02050d"

    );





    ctx.fillStyle =

        gradient;



    ctx.fillRect(

        0,

        0,

        W,

        H

    );





    // Nebula trái



    const glow1 =

        ctx.createRadialGradient(

            150,

            330,

            0,

            150,

            330,

            350

        );





    glow1.addColorStop(

        0,

        "rgba(0,150,255,.18)"

    );



    glow1.addColorStop(

        1,

        "rgba(0,150,255,0)"

    );





    ctx.fillStyle =

        glow1;



    ctx.fillRect(

        0,

        0,

        W,

        H

    );





    // Nebula phải



    const glow2 =

        ctx.createRadialGradient(

            930,

            350,

            0,

            930,

            350,

            350

        );





    glow2.addColorStop(

        0,

        "rgba(170,40,255,.15)"

    );



    glow2.addColorStop(

        1,

        "rgba(170,40,255,0)"

    );





    ctx.fillStyle =

        glow2;



    ctx.fillRect(

        0,

        0,

        W,

        H

    );





    // Sao



    for (

        const s of stars

    ) {



        s.y += s.speed;





        if (

            s.y > H

        ) {



            s.y = 0;



            s.x =

                Math.random() *

                W;

        }





        ctx.globalAlpha =

            s.alpha;



        ctx.fillStyle =

            "#dcecff";





        ctx.beginPath();



        ctx.arc(

            s.x,

            s.y,

            s.size,

            0,

            Math.PI * 2

        );



        ctx.fill();

    }





    ctx.globalAlpha = 1;





    // Sàn



    const floor =

        ctx.createLinearGradient(

            0,

            H - 130,

            0,

            H

        );





    floor.addColorStop(

        0,

        "rgba(0,120,255,0)"

    );



    floor.addColorStop(

        1,

        "rgba(0,100,255,.18)"

    );





    ctx.fillStyle =

        floor;



    ctx.fillRect(

        0,

        H - 130,

        W,

        130

    );

}





// =====================================================

// POWER UPS

// =====================================================



let powerUps = [];





const powerTypes = [



    {

        type: "wide",

        symbol: "━",

        color: "#39ff88",

        name: "PADDLE +"

    },



    {

        type: "multi",

        symbol: "✦",

        color: "#ffd43b",

        name: "MULTI BALL"

    },



    {

        type: "slow",

        symbol: "◉",

        color: "#46baff",

        name: "SLOW BALL"

    },



    {

        type: "life",

        symbol: "♥",

        color: "#ff4d6d",

        name: "EXTRA LIFE"

    }

];





function spawnPowerUp(

    x,

    y

) {



    if (

        Math.random() > 0.25

    ) {

        return;

    }





    const type =

        powerTypes[

            Math.floor(

                Math.random() *

                powerTypes.length

            )

        ];





    powerUps.push({



        x,



        y,



        size: 18,



        speed: 3.5,



        type

    });

}





function updatePowerUps() {



    for (

        let i = powerUps.length - 1;

        i >= 0;

        i--

    ) {



        const p =

            powerUps[i];





        p.y += p.speed;





        if (



            p.y + p.size >

            paddle.y &&



            p.y - p.size <

            paddle.y +

            paddle.height &&



            p.x >

            paddle.x &&



            p.x <

            paddle.x +

            paddle.width



        ) {



            activatePower(

                p.type.type

            );



            powerUps.splice(

                i,

                1

            );



            continue;

        }





        if (

            p.y >

            H + 40

        ) {



            powerUps.splice(

                i,

                1

            );

        }

    }

}





function drawPowerUps() {



    for (

        const p of powerUps

    ) {



        ctx.save();



        ctx.shadowBlur = 25;



        ctx.shadowColor =

            p.type.color;



        ctx.fillStyle =

            p.type.color;





        ctx.beginPath();



        ctx.arc(

            p.x,

            p.y,

            p.size,

            0,

            Math.PI * 2

        );



        ctx.fill();





        ctx.fillStyle =

            "#06101c";



        ctx.font =

            "bold 15px Arial";



        ctx.textAlign =

            "center";



        ctx.textBaseline =

            "middle";





        ctx.fillText(

            p.type.symbol,

            p.x,

            p.y

        );





        ctx.restore();

    }

}





// =====================================================

// POWER ACTIVATION

// =====================================================



function activatePower(type) {



    const info =

        powerTypes.find(

            p =>

                p.type === type

        );





    powerText.textContent =

        "POWER-UP: " +

        info.name;





    if (

        type === "wide"

    ) {



        paddle.width =

            paddle.baseWidth *

            1.7;



        paddle.powerTimer =

            700;

    }





    if (

        type === "multi"

    ) {



        const original =

            balls[0];



        if (!original) {

            return;

        }





        const speed =

            Math.sqrt(

                original.dx ** 2 +

                original.dy ** 2

            );





        balls.push(

            createBall(

                original.x,

                original.y,

                speed,

                -speed

            )

        );





        balls.push(

            createBall(

                original.x,

                original.y,

                -speed,

                -speed

            )

        );

    }





    if (

        type === "slow"

    ) {



        for (

            const ball of balls

        ) {



            ball.dx *= 0.65;

            ball.dy *= 0.65;

        }

    }





    if (

        type === "life"

    ) {



        lives =

            Math.min(

                lives + 1,

                5

            );



        updateLives();

    }

}





// =====================================================

// PADDLE

// =====================================================



function updatePaddle() {



    if (

        paddle.left

    ) {



        paddle.x -=

            paddle.speed;

    }





    if (

        paddle.right

    ) {



        paddle.x +=

            paddle.speed;

    }





    clampPaddle();

}





function clampPaddle() {



    if (

        paddle.x < 0

    ) {



        paddle.x = 0;

    }





    if (

        paddle.x +

        paddle.width >

        W

    ) {



        paddle.x =

            W -

            paddle.width;

    }

}





// =====================================================

// PADDLE COLLISION

// =====================================================



function ballPaddleCollision(

    ball

) {



    if (



        ball.y +

        ball.radius >=

        paddle.y &&



        ball.y -

        ball.radius <=

        paddle.y +

        paddle.height &&



        ball.x >=

        paddle.x &&



        ball.x <=

        paddle.x +

        paddle.width &&



        ball.dy > 0



    ) {



        ball.y =

            paddle.y -

            ball.radius;





        const hit =

            (

                ball.x -

                paddle.x

            ) /

            paddle.width;





        const angle =

            (

                hit -

                0.5

            ) *

            Math.PI *

            0.85;





        const speed =

            Math.sqrt(

                ball.dx ** 2 +

                ball.dy ** 2

            );





        ball.dx =

            Math.sin(angle) *

            speed;





        ball.dy =

            -Math.abs(

                Math.cos(angle) *

                speed

            );





        explode(

            ball.x,

            paddle.y,

            "#5cc8ff",

            12

        );

    }

}





// =====================================================

// BRICK COLLISION

// =====================================================



function checkBrickCollision(

    ball

) {



    for (

        const b of bricks

    ) {



        if (

            !b.alive

        ) {

            continue;

        }





        if (



            ball.x +

            ball.radius >

            b.x &&



            ball.x -

            ball.radius <

            b.x +

            b.width &&



            ball.y +

            ball.radius >

            b.y &&



            ball.y -

            ball.radius <

            b.y +

            b.height



        ) {



            b.hp--;





            if (

                b.hp <= 0

            ) {



                b.alive =

                    false;





                const color =

                    brickColors[

                        b.row

                    ];





                explode(

                    b.x +

                    b.width / 2,



                    b.y +

                    b.height / 2,



                    color,



                    65

                );





                spawnPowerUp(

                    b.x +

                    b.width / 2,



                    b.y +

                    b.height / 2

                );





                combo++;





                const value =

                    b.special

                        ? 50 +

                          combo * 2

                        : 10 +

                          combo;





                addScore(

                    value

                );





                showScore(

                    b.x +

                    b.width / 2,



                    b.y,



                    value

                );





                // Phá sạch một hàng ngang hoặc một cột dọc
                // => lập tức thêm hàng gạch mới.
                checkClearedLines(b.rowId, b.col);

                shake = 9;



            } else {



                explode(

                    b.x +

                    b.width / 2,



                    b.y +

                    b.height / 2,



                    "#ffffff",



                    15

                );



                addScore(5);

            }





            ball.dy *= -1;



            return;

        }

    }

}





// =====================================================

// BALL UPDATE

// =====================================================



function updateBalls() {



    for (

        let i = balls.length - 1;

        i >= 0;

        i--

    ) {



        const ball =

            balls[i];





        // Trail



        ball.trail.push({

            x: ball.x,

            y: ball.y

        });





        if (

            ball.trail.length > 12

        ) {



            ball.trail.shift();

        }





        ball.x += ball.dx;

        ball.y += ball.dy;





        // Left



        if (

            ball.x -

            ball.radius <= 0

        ) {



            ball.x =

                ball.radius;



            ball.dx *= -1;

        }





        // Right



        if (

            ball.x +

            ball.radius >= W

        ) {



            ball.x =

                W -

                ball.radius;



            ball.dx *= -1;

        }





        // Top



        if (

            ball.y -

            ball.radius <= 0

        ) {



            ball.y =

                ball.radius;



            ball.dy *= -1;

        }





        ballPaddleCollision(

            ball

        );





        checkBrickCollision(

            ball

        );





        // Rơi khỏi màn hình



        if (

            ball.y -

            ball.radius >

            H

        ) {



            balls.splice(

                i,

                1

            );

        }

    }





    if (balls.length === 0) {



    loseLife();



} else if (balls.length === 1) {



    // Khi chỉ còn 1 bóng:

    // tăng tốc để cuối lượt không bị quá chậm



    const ball = balls[0];



    const currentSpeed =

        Math.sqrt(

            ball.dx * ball.dx +

            ball.dy * ball.dy

        );



    const targetSpeed = 10.5;



    if (currentSpeed < targetSpeed) {



        const ratio =

            targetSpeed / currentSpeed;



        ball.dx *= ratio;

        ball.dy *= ratio;

    }

}

}





// =====================================================

// BALL DRAW

// =====================================================



function drawBalls() {



    for (

        const ball of balls

    ) {



        for (

            let i = 0;

            i < ball.trail.length;

            i++

        ) {



            const p =

                ball.trail[i];





            const alpha =

                (

                    i /

                    ball.trail.length

                ) *

                0.4;





            ctx.fillStyle =

                `rgba(60,190,255,${alpha})`;





            ctx.beginPath();



            ctx.arc(

                p.x,

                p.y,

                3,

                0,

                Math.PI * 2

            );



            ctx.fill();

        }





        ctx.save();



        ctx.shadowBlur = 30;



        ctx.shadowColor =

            "#45caff";



        ctx.fillStyle =

            "#ffffff";





        ctx.beginPath();



        ctx.arc(

            ball.x,

            ball.y,

            ball.radius,

            0,

            Math.PI * 2

        );



        ctx.fill();



        ctx.restore();

    }

}





// =====================================================

// BRICK DRAW

// =====================================================



function drawBricks() {



    for (

        const b of bricks

    ) {



        if (

            !b.alive

        ) {

            continue;

        }





        const color =

            brickColors[

                b.row

            ];





        ctx.save();



        ctx.shadowBlur =

            b.special

                ? 22

                : 10;



        ctx.shadowColor =

            color;



        ctx.fillStyle =

            color;





        roundRect(

            b.x,

            b.y,

            b.width,

            b.height,

            5

        );



        ctx.fill();





        // Highlight



        ctx.fillStyle =

            "rgba(255,255,255,.20)";





        roundRect(

            b.x + 2,

            b.y + 2,

            b.width - 4,

            5,

            2

        );



        ctx.fill();





        // Gạch 2 HP



        if (

            b.hp === 2

        ) {



            ctx.strokeStyle =

                "rgba(255,255,255,.7)";



            ctx.lineWidth = 2;





            ctx.strokeRect(

                b.x + 5,

                b.y + 7,

                b.width - 10,

                b.height - 12

            );

        }





        // Gạch đặc biệt



        if (

            b.special

        ) {



            ctx.fillStyle =

                "#ffffff";



            ctx.font =

                "bold 14px Arial";



            ctx.textAlign =

                "center";



            ctx.textBaseline =

                "middle";





            ctx.fillText(

                "★",

                b.x +

                b.width / 2,

                b.y +

                b.height / 2

            );

        }





        ctx.restore();

    }

}





// =====================================================

// PADDLE DRAW

// =====================================================



function drawPaddle() {



    ctx.save();



    ctx.shadowBlur = 30;



    ctx.shadowColor =

        "#38baff";



    ctx.fillStyle =

        "#ffffff";





    roundRect(

        paddle.x,

        paddle.y,

        paddle.width,

        paddle.height,

        8

    );



    ctx.fill();



    ctx.restore();

}





// =====================================================

// ROUND RECT

// =====================================================



function roundRect(

    x,

    y,

    width,

    height,

    radius

) {



    ctx.beginPath();



    ctx.roundRect(

        x,

        y,

        width,

        height,

        radius

    );

}





// =====================================================

// SCORE

// =====================================================



function addScore(

    amount

) {



    score += amount;



    scoreEl.textContent =

        score;





    if (

        score > best

    ) {



        best =

            score;



        bestEl.textContent =

            best;





        localStorage.setItem(

            "brick_best_score",

            best

        );

    }

}





// =====================================================

// LIVES

// =====================================================



function updateLives() {



    livesEl.textContent =

        "♥ ".repeat(

            lives

        ).trim();

}





// =====================================================

// LOSE LIFE

// =====================================================



function loseLife() {



    lives--;



    combo = 0;



    updateLives();





    paddle.width =

        paddle.baseWidth;



    paddle.powerTimer =

        0;





    powerText.textContent =

        "POWER-UP: NONE";





    if (

        lives <= 0

    ) {



        gameOver();



        return;

    }





    resetBalls();

}





// =====================================================

// POWER TIMER

// =====================================================



function updatePaddlePower() {



    if (

        paddle.powerTimer > 0

    ) {



        paddle.powerTimer--;





        if (

            paddle.powerTimer <= 0

        ) {



            paddle.width =

                paddle.baseWidth;



            powerText.textContent =

                "POWER-UP: NONE";

        }

    }

}





// =====================================================

// DYNAMIC BRICKS

// =====================================================



function updateBrickSystem() {



    brickDropTimer +=

        16.67;





    // Càng lâu càng nhanh



    brickDropInterval =

        Math.max(

            2200,

            4200 -

            gameTime * 80

        );





    if (

        brickDropTimer >=

        brickDropInterval

    ) {



        brickDropTimer =

            0;



        dropBricks();

    }





    // Nếu gạch chạm paddle



    for (

        const b of bricks

    ) {



        if (

            !b.alive

        ) {

            continue;

        }





        if (

            b.y +

            b.height >=

            paddle.y - 10

        ) {



            gameOver();



            return;

        }

    }

}





// =====================================================

// TĂNG TỐC BÓNG

// =====================================================



function updateBallSpeed() {



    speedTimer +=

        16.67;





    if (

        speedTimer >= 5000

    ) {



        speedTimer = 0;





        for (

            const ball of balls

        ) {



            const speed =

                Math.sqrt(

                    ball.dx ** 2 +

                    ball.dy ** 2

                );





            if (

                speed < 14

            ) {



                ball.dx *= 1.045;

                ball.dy *= 1.045;

            }

        }

    }

}





// =====================================================

// UPDATE

// =====================================================



function update() {



    if (

        paused ||

        !running

    ) {

        return;

    }





    gameTime +=

        1 / 60;





    updatePaddle();



    updateBalls();



    updateParticles();



    updateScorePopups();



    updatePowerUps();



    updatePaddlePower();



    updateBrickSystem();



    updateBallSpeed();





    if (

        shake > 0

    ) {



        shake *= 0.88;





        if (

            shake < 0.2

        ) {



            shake = 0;

        }

    }

}





// =====================================================

// DRAW

// =====================================================



function draw() {



    ctx.save();





    if (

        shake > 0

    ) {



        ctx.translate(

            (Math.random() - 0.5) *

            shake,



            (Math.random() - 0.5) *

            shake

        );

    }





    drawBackground();



    drawBricks();



    drawPowerUps();



    drawParticles();



    drawScorePopups();



    drawPaddle();



    drawBalls();





    ctx.restore();

}





// =====================================================

// GAME LOOP

// =====================================================



function loop() {



    if (

        !running

    ) {

        return;

    }





    update();



    draw();



    requestAnimationFrame(

        loop

    );

}





// =====================================================

// START GAME

// =====================================================



function startGame() {



    score = 0;



    lives = 3;



    combo = 0;



    gameTime = 0;



    brickDropTimer = 0;



    speedTimer = 0;



    shake = 0;



    paused = false;





    particles = [];



    scorePopups = [];



    powerUps = [];





    paddle.width =

        paddle.baseWidth;



    paddle.x =

        W / 2 -

        paddle.width / 2;



    paddle.powerTimer = 0;





    createInitialBricks();



    resetBalls();



    updateLives();





    scoreEl.textContent =

        "0";





    powerText.textContent =

        "POWER-UP: NONE";





    running = true;





    overlay.classList.add(

        "hidden"

    );





    pauseBtn.textContent =

        "Ⅱ";





    requestAnimationFrame(

        loop

    );

}





// =====================================================

// GAME OVER

// =====================================================



function gameOver() {



    running = false;



    paused = false;





    menuTitle.textContent =

        "GAME OVER";





    menuText.textContent =

        `Bạn đạt ${score} điểm.`;





    playBtn.textContent =

        "PLAY AGAIN";





    overlay.classList.remove(

        "hidden"

    );

}





// =====================================================

// PAUSE

// =====================================================



function togglePause() {



    if (

        !running

    ) {

        return;

    }





    paused =

        !paused;





    if (

        paused

    ) {



        menuTitle.textContent =

            "PAUSED";





        menuText.textContent =

            "Game đang tạm dừng.";





        playBtn.textContent =

            "RESUME";





        overlay.classList.remove(

            "hidden"

        );





        pauseBtn.textContent =

            "▶";



    } else {



        overlay.classList.add(

            "hidden"

        );





        pauseBtn.textContent =

            "Ⅱ";

    }

}





pauseBtn.addEventListener(

    "click",

    togglePause

);





// =====================================================

// KEYBOARD

// =====================================================



document.addEventListener(

    "keydown",

    e => {



        const key =

            e.key.toLowerCase();





        if (

            key === "a" ||

            e.key === "ArrowLeft"

        ) {



            paddle.left = true;



            e.preventDefault();

        }





        if (

            key === "d" ||

            e.key === "ArrowRight"

        ) {



            paddle.right = true;



            e.preventDefault();

        }





        if (

            e.key === " "

        ) {



            if (

                running

            ) {



                togglePause();

            }

        }

    }

);





document.addEventListener(

    "keyup",

    e => {



        const key =

            e.key.toLowerCase();





        if (

            key === "a" ||

            e.key === "ArrowLeft"

        ) {



            paddle.left = false;

        }





        if (

            key === "d" ||

            e.key === "ArrowRight"

        ) {



            paddle.right = false;

        }

    }

);





// =====================================================

// MOBILE TOUCH

// =====================================================



canvas.addEventListener(

    "touchmove",

    e => {



        const rect =

            canvas.getBoundingClientRect();





        const touch =

            e.touches[0];





        const x =

            (

                touch.clientX -

                rect.left

            ) *

            (

                W /

                rect.width

            );





        paddle.x =

            x -

            paddle.width / 2;





        clampPaddle();





        e.preventDefault();



    },

    {

        passive: false

    }

);





// =====================================================

// PLAY

// =====================================================



playBtn.addEventListener(

    "click",

    () => {



        if (

            running &&

            paused

        ) {



            togglePause();



        } else {



            menuTitle.textContent =

                "BRICK BREAKER";



            startGame();

        }

    }

);





// =====================================================

// MENU

// =====================================================



menuBtn.addEventListener(

    "click",

    () => {



        running = false;



        paused = false;



        paddle.left = false;

        paddle.right = false;



        /*

            Game nằm trong thư mục:

            TienHub/

                index.html

                mini-games/

                    brick/

                        index.html



            nên ../.. sẽ quay về TienHub.

        */



        window.location.href =

            "../../index.html";

    }

);





// =====================================================

// INITIAL SCREEN

// =====================================================



createInitialBricks();



resetBalls();



updateLives();



draw();