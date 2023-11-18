var canvas = document.getElementById("canvas");
var field_cf = {width: 3000, height: 3000, n_cells: 80, wave_length: 0.5};

canvas.style.width = field_cf.width;
canvas.style.height = field_cf.height;

let colors = {
    0: "rgb(110 139 94)", // land
    1: "rgb(189 177 131)", // savanna
    2: "rgb(49 64 124)", // shallow
    3: "rgb(33 43 82)" // ocean
};

function assignElevation(map, w, h, wave_length) {
    const noise = new SimplexNoise();

    let {points, numRegions} = map;
    let elevation = [];

    for (let r = 0; r < numRegions; r++) {
        let nx = points[r].cent.x / w - 1 / 2,
            ny = points[r].cent.y / h - 1 / 2;

        // start with noise:
        elevation[r] = (1 + noise.noise2D(nx / wave_length, ny / wave_length)) / 2;
        // modify noise to make islands:
        let d = 2 * Math.max(Math.abs(nx), Math.abs(ny)); // should be 0-1
            d = (1 + elevation[r] - d) / 2;
        
        if (d > 0.58) {
            elevation[r] = 0;
        } else if (d > 0.47) {
            elevation[r] = 2;
        } else {
            elevation[r] = 3;
        }
    }

    return elevation;
}


function generate_field() {
    let points = grid_points(field_cf.n_cells, 0.5, 
        field_cf.width, field_cf.height);
    
    let cells = get_cells(points, field_cf.width, field_cf.height);

    draw_poly(cells, field_cf);
}


function grid_points(grid_size, jitter, w, h) {
    let points = [];

    for (let x = 0; x < grid_size; x++) {
        for (let y = 0; y < grid_size; y++) {
            points.push({x: (x + jitter * (Math.random() - Math.random())) / grid_size * w,
                         y: (y + jitter * (Math.random() - Math.random())) / grid_size * h});
        }
    }

    return points;
}

function edgesAroundPoint(delaunay, start) {
    const result = [];
    let incoming = start;

    do {
        result.push(incoming);
        const outgoing = nextHalfedge(incoming);
        incoming = delaunay.halfedges[outgoing];
    } while (incoming !== -1 && incoming !== start);

    return result;
}

function triangleOfEdge(e)  { return Math.floor(e / 3); }
function nextHalfedge(e) { return (e % 3 === 2) ? e - 2 : e + 1; }

function meanCoord(c) {
    let x = 0, y = 0;

    for (let i = 0; i < c.length; i++) {
        x += c[i].x; y += c[i].y;
    }

    return {x: x / c.length, y: y / c.length};
}

function dist(x1, r) {
    return Math.pow(Math.pow(x1.x - r.x, 2) + Math.pow(x1.y - r.y, 2), 0.5);
}

function get_cells(points, w, h) {
    let delaunay = Delaunator.from(points, loc => loc.x, loc => loc.y);

    let map = {
        points,
        numRegions: points.length,
        numTriangles: delaunay.halfedges.length / 3,
        numEdges: delaunay.halfedges.length,
        halfedges: delaunay.halfedges,
        triangles: delaunay.triangles,
        centers: calculateCentroids(points, delaunay)
    };

    let seen = new Set();
    let vertices, cent, poly = [], d;

    for (let e = 0; e < map.numEdges; e++) {
        const r = map.triangles[nextHalfedge(e)];
        if (!seen.has(r)) {
            seen.add(r);
            vertices = edgesAroundPoint(delaunay, e)
                .map(e => map.centers[triangleOfEdge(e)]);

            cent = meanCoord(vertices);

            // if (dist(cent, {x: w / 2, y: h / 2}) > w / 2 * 0.8) {
            //     continue;
            // }

            if (cent.x / w < 0.1 || cent.x / w > 0.9) {
                continue;
            }

            if (cent.y / w < 0.1 || cent.y / w > 0.9) {
                continue;
            }

            poly.push({c: vertices, cent: cent});
        }
    }

    return poly;
}

function calculateCentroids(points, delaunay) {
    const numTriangles = delaunay.halfedges.length / 3;
    let centroids = [];
    for (let t = 0; t < numTriangles; t++) {
        let sumOfX = 0, sumOfY = 0;
        for (let i = 0; i < 3; i++) {
            let s = 3*t + i;
            let p = points[delaunay.triangles[s]];
            sumOfX += p.x;
            sumOfY += p.y;
        }
        centroids[t] = {x: sumOfX / 3, y: sumOfY / 3};
    }
    return centroids;
}

function draw_poly(blocks, config) {
    let block = undefined;
    let points = undefined;

    canvas.innerHTML = "";
    
    assign = assignElevation({points: blocks, numRegions: blocks.length}, 
        config.width, config.height, config.wave_length);

    console.log(assign);

    for (let i = 0; i < blocks.length; i++) {
        points = "";

        for (let j = 0; j < blocks[i].c.length; j++) {
            points += blocks[i].c[j].x + "," + blocks[i].c[j].y + " ";
        }

        block = document.createElementNS("http://www.w3.org/2000/svg", "polygon");

        block.setAttribute("points", points);
        block.setAttribute("class", "block c" + assign[i]);

        block.setAttribute("cent_x", blocks[i].cent.x);
        block.setAttribute("cent_y", blocks[i].cent.y);

        block.style.fill = colors[assign[i]];

        block.onclick = function() { 
            let block = document.createElementNS("http://www.w3.org/2000/svg", "image");
            
            block.setAttribute("href", "imgs/man.png");
            block.setAttribute("x", this.getAttribute("cent_x") - 20);
            block.setAttribute("y", this.getAttribute("cent_y") - 20);

            block.setAttribute("width", "45px");
            block.setAttribute("height", "45px");

            canvas.append(block);
        };

        canvas.append(block);

        if (assign[i] == 3 || assign[i] == 2) {
            block = document.createElementNS("http://www.w3.org/2000/svg", "image");

            block.setAttribute("href", "imgs/w1.png");
            block.setAttribute("x", Math.round(blocks[i].cent.x - 6) + "px");
            block.setAttribute("y", Math.round(blocks[i].cent.y - 6) + "px");

            block.setAttribute("width", "20px");
            block.setAttribute("height", "20px");

            canvas.append(block);
        }
    }
}