import { pageHead } from "@/lib/seo";
import { Link, createFileRoute } from "@tanstack/react-router";
import { site } from "@/content/site";

export const Route = createFileRoute("/")({
  head:()=>pageHead({path:'/',title:'VOW — Goal planning & accountability app',description:'VOW is a goal-planning and accountability app by Joshua Nathan Kasanga. Turn goals into structured plans, scheduled sessions and honest progress reviews.'}),
  component: Home,
});

const steps = [
  ["01", "Make it concrete", "Turn what you want into a defined outcome, milestones and a practical sequence."],
  ["02", "Put it into motion", "Build sessions around real time, real constraints and the work that actually needs doing."],
  ["03", "Keep your VOW", "Review what happened, learn from the evidence and adjust without losing the goal."],
];

function Home() {
  return (
    <>
      <section className="relative min-h-[82vh] overflow-hidden bg-vow-bg text-vow-ink">
        <div className="absolute inset-0 vow-hero-art" aria-hidden />
                <div className="vow-paint-splash" aria-hidden>
<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" role="presentation">
<path d="M1276.3 164.8Q1276.2 173.8 1271.2 176.7Q1266.1 179.5 1264.4 186.5Q1262.7 193.5 1255.8 189.9Q1248.9 186.3 1243.7 183.8Q1238.5 181.3 1228.7 177.0Q1218.9 172.7 1226.8 170.4Q1234.7 168.0 1234.7 164.2Q1234.6 160.4 1238.0 154.8Q1241.4 149.1 1253.2 149.1Q1264.9 149.0 1270.7 152.4Q1276.4 155.8 1276.3 164.8Z"/>
<circle cx="1263.1" cy="149.4" r="6.6"/>
<circle cx="1238.2" cy="197.0" r="1.2"/>
<circle cx="1259.6" cy="76.8" r="2.4"/>
<circle cx="1359.2" cy="12.7" r="6.9"/>
<circle cx="1418.3" cy="170.6" r="1.2"/>
<circle cx="1476.4" cy="26.9" r="1.5"/>
<circle cx="1310.3" cy="199.8" r="4.9"/>
<circle cx="1254.4" cy="145.6" r="2.2"/>
<path d="M1312.1 153.9Q1312.6 156.3 1312.8 158.7Q1313.0 161.2 1309.0 161.6Q1305.0 162.1 1303.2 160.4Q1301.5 158.7 1300.8 157.1Q1300.2 155.5 1302.0 152.2Q1303.8 148.8 1307.7 150.1Q1311.6 151.4 1312.1 153.9Z"/>
<circle cx="1172.3" cy="230.8" r="1.2"/>
<circle cx="1371.9" cy="161.8" r="1.2"/>
<circle cx="1248.4" cy="201.4" r="1.9"/>
<circle cx="1339.2" cy="214.3" r="1.2"/>
<circle cx="1228.0" cy="157.4" r="2.5"/>
<path d="M1125.4 207.7Q1128.1 211.0 1124.9 214.7Q1121.8 218.3 1116.0 218.8Q1110.2 219.2 1104.3 217.4Q1098.3 215.6 1099.6 209.1Q1100.9 202.6 1106.2 203.4Q1111.6 204.1 1117.1 204.3Q1122.7 204.4 1125.4 207.7Z"/>
<circle cx="1246.7" cy="244.1" r="1.7"/>
<circle cx="1308.0" cy="284.6" r="5.5"/>
<path d="M1288.5 182.9Q1291.0 185.3 1289.2 187.1Q1287.4 188.8 1284.1 189.6Q1280.8 190.4 1277.0 189.5Q1273.1 188.6 1272.0 184.4Q1270.9 180.2 1275.7 177.7Q1280.5 175.2 1283.2 177.9Q1286.0 180.5 1288.5 182.9Z"/>
<circle cx="1363.4" cy="98.3" r="5.1"/>
<circle cx="1392.8" cy="136.0" r="2.7"/>
<circle cx="1245.5" cy="133.2" r="2.0"/>
<circle cx="1370.7" cy="169.5" r="5.9"/>
<circle cx="1307.9" cy="128.0" r="6.5"/>
<circle cx="1228.9" cy="99.4" r="2.1"/>
<path d="M1324.3 118.3Q1326.3 121.7 1325.0 123.8Q1323.8 125.9 1321.0 127.3Q1318.2 128.7 1314.3 125.7Q1310.5 122.7 1311.2 120.0Q1311.9 117.3 1315.0 116.5Q1318.1 115.6 1320.2 115.2Q1322.3 114.8 1324.3 118.3Z"/>
<circle cx="1260.9" cy="257.0" r="5.7"/>
<circle cx="1077.7" cy="173.0" r="1.2"/>
<circle cx="1403.1" cy="180.9" r="1.5"/>
<path d="M1250.0 170.0Q1223.7 159.1 1223.7 115.8" fill="none" strokeWidth="3.1" strokeLinecap="round"/>
<path d="M1250.0 170.0Q1190.8 196.6 1145.5 209.9" fill="none" strokeWidth="2.0" strokeLinecap="round"/>
<path d="M1567.6 499.9Q1579.8 505.4 1570.2 508.0Q1560.7 510.6 1558.5 522.3Q1556.3 534.0 1543.4 533.1Q1530.5 532.2 1527.3 525.5Q1524.2 518.8 1519.3 514.2Q1514.4 509.6 1515.2 501.5Q1515.9 493.3 1520.8 487.7Q1525.7 482.0 1526.3 477.5Q1527.0 472.9 1541.3 475.4Q1555.7 477.9 1555.5 486.2Q1555.3 494.5 1567.6 499.9Z"/>
<circle cx="1543.5" cy="544.3" r="1.2"/>
<circle cx="1480.9" cy="437.1" r="5.0"/>
<circle cx="1590.5" cy="365.9" r="1.2"/>
<circle cx="1589.7" cy="603.4" r="5.6"/>
<circle cx="1551.4" cy="523.8" r="1.7"/>
<circle cx="1452.5" cy="423.4" r="6.3"/>
<circle cx="1565.2" cy="488.6" r="3.2"/>
<path d="M1505.6 448.7Q1507.6 454.2 1505.3 459.9Q1503.1 465.6 1497.8 464.6Q1492.4 463.5 1487.6 461.0Q1482.8 458.6 1482.0 454.3Q1481.2 450.0 1487.9 446.7Q1494.7 443.4 1499.2 443.2Q1503.6 443.1 1505.6 448.7Z"/>
<path d="M1552.8 456.6Q1554.6 458.8 1553.0 462.3Q1551.4 465.7 1547.6 466.9Q1543.9 468.1 1539.7 465.6Q1535.5 463.1 1535.1 459.9Q1534.7 456.7 1538.2 455.2Q1541.7 453.7 1546.4 454.0Q1551.0 454.4 1552.8 456.6Z"/>
<circle cx="1552.0" cy="482.0" r="4.4"/>
<circle cx="1579.1" cy="645.5" r="3.0"/>
<circle cx="1362.4" cy="412.3" r="1.2"/>
<path d="M1575.1 498.3Q1579.6 504.0 1576.4 510.7Q1573.2 517.4 1567.1 518.5Q1561.0 519.7 1550.1 514.2Q1539.3 508.7 1544.0 503.7Q1548.8 498.7 1554.2 491.5Q1559.7 484.4 1565.1 488.5Q1570.6 492.7 1575.1 498.3Z"/>
<circle cx="1553.2" cy="535.9" r="2.0"/>
<path d="M1540.0 500.0Q1537.4 464.9 1533.9 449.8" fill="none" strokeWidth="2.0" strokeLinecap="round"/>
<path d="M818.8 104.9Q818.4 109.2 815.9 112.4Q813.3 115.5 810.4 121.9Q807.5 128.3 801.3 129.1Q795.1 130.0 788.3 128.6Q781.4 127.1 782.9 121.4Q784.4 115.7 777.9 110.5Q771.4 105.2 779.9 103.0Q788.4 100.8 792.7 99.5Q797.0 98.2 803.4 95.5Q809.8 92.8 814.4 96.7Q819.1 100.6 818.8 104.9Z"/>
<path d="M837.0 184.9Q842.1 189.0 839.7 195.5Q837.2 202.1 831.2 201.2Q825.2 200.2 818.0 198.7Q810.8 197.3 812.0 192.8Q813.2 188.2 818.6 179.4Q824.0 170.6 827.9 175.8Q831.8 180.9 837.0 184.9Z"/>
<circle cx="640.2" cy="148.8" r="5.7"/>
<circle cx="765.7" cy="126.1" r="4.8"/>
<circle cx="861.8" cy="115.2" r="1.2"/>
<circle cx="654.0" cy="153.5" r="5.5"/>
<circle cx="771.3" cy="129.4" r="3.8"/>
<path d="M871.2 112.8Q872.9 117.3 869.7 120.4Q866.5 123.4 861.9 126.2Q857.2 129.1 852.9 125.8Q848.5 122.5 848.8 116.3Q849.2 110.1 854.3 106.8Q859.5 103.4 864.5 105.9Q869.5 108.3 871.2 112.8Z"/>
<circle cx="786.4" cy="31.7" r="3.0"/>
<circle cx="848.1" cy="113.2" r="2.2"/>
<path d="M772.9 63.1Q776.3 67.0 774.2 71.4Q772.1 75.9 764.4 77.6Q756.7 79.3 751.1 75.0Q745.5 70.7 747.0 65.4Q748.5 60.1 754.5 59.2Q760.4 58.4 765.0 58.8Q769.6 59.2 772.9 63.1Z"/>
<circle cx="847.1" cy="78.3" r="4.0"/>
<path d="M710.2 95.7Q717.1 105.7 711.1 113.0Q705.2 120.4 693.3 119.8Q681.5 119.3 675.2 117.7Q668.9 116.1 664.3 106.9Q659.7 97.8 671.6 91.2Q683.5 84.5 693.4 85.1Q703.3 85.7 710.2 95.7Z"/>
<circle cx="791.8" cy="148.3" r="6.6"/>
<circle cx="779.0" cy="180.7" r="1.2"/>
<path d="M820.3 128.5Q823.0 130.2 822.0 133.6Q821.0 136.9 817.1 137.6Q813.2 138.3 809.1 136.1Q805.0 133.9 805.1 130.3Q805.2 126.8 808.3 124.2Q811.4 121.7 814.5 124.2Q817.5 126.7 820.3 128.5Z"/>
<circle cx="774.3" cy="117.4" r="4.0"/>
<circle cx="830.2" cy="140.0" r="3.0"/>
<circle cx="763.5" cy="45.7" r="4.2"/>
<path d="M777.8 124.2Q779.2 127.3 775.9 129.3Q772.6 131.3 769.1 133.0Q765.5 134.8 764.3 132.5Q763.0 130.2 762.3 127.0Q761.6 123.8 764.9 123.0Q768.2 122.2 772.3 121.6Q776.5 121.0 777.8 124.2Z"/>
<circle cx="870.9" cy="128.0" r="2.7"/>
<circle cx="770.5" cy="81.1" r="1.2"/>
<circle cx="754.1" cy="97.7" r="5.8"/>
<circle cx="768.2" cy="99.5" r="5.3"/>
<path d="M800.0 110.0Q765.8 126.9 754.8 156.3" fill="none" strokeWidth="3.4" strokeLinecap="round"/>
<path d="M800.0 110.0Q795.5 105.2 821.4 75.6" fill="none" strokeWidth="3.1" strokeLinecap="round"/>
<path d="M123.3 85.5Q121.8 89.7 123.4 94.1Q125.0 98.5 121.3 100.7Q117.6 102.8 111.6 101.9Q105.7 100.9 102.5 101.7Q99.4 102.5 97.5 99.2Q95.6 95.9 97.0 90.9Q98.4 85.9 99.9 84.8Q101.3 83.6 103.8 81.3Q106.2 79.1 111.1 80.6Q115.9 82.1 120.3 81.7Q124.8 81.3 123.3 85.5Z"/>
<path d="M153.8 114.0Q156.8 120.4 151.8 123.1Q146.9 125.8 142.4 129.7Q137.8 133.6 134.3 128.4Q130.7 123.1 130.1 118.6Q129.6 114.2 132.9 110.2Q136.3 106.1 143.5 106.8Q150.8 107.6 153.8 114.0Z"/>
<circle cx="155.8" cy="182.1" r="6.5"/>
<circle cx="126.7" cy="74.5" r="3.9"/>
<circle cx="77.6" cy="80.8" r="4.4"/>
<circle cx="197.4" cy="71.3" r="1.2"/>
<circle cx="120.3" cy="47.7" r="6.9"/>
<circle cx="137.2" cy="70.0" r="1.2"/>
<circle cx="51.7" cy="24.6" r="4.9"/>
<path d="M121.3 113.9Q122.1 117.0 120.8 119.8Q119.5 122.7 116.0 124.0Q112.5 125.3 109.7 123.2Q107.0 121.1 107.3 116.8Q107.5 112.4 111.0 110.5Q114.4 108.5 117.5 109.7Q120.6 110.9 121.3 113.9Z"/>
<circle cx="22.1" cy="137.2" r="2.5"/>
<circle cx="128.9" cy="114.8" r="2.5"/>
<path d="M140.8 150.3Q144.4 154.1 142.7 161.2Q141.0 168.4 134.8 169.5Q128.6 170.7 123.1 164.7Q117.6 158.6 116.8 155.6Q115.9 152.6 121.5 147.4Q127.0 142.3 132.1 144.4Q137.2 146.5 140.8 150.3Z"/>
<circle cx="112.1" cy="45.1" r="1.9"/>
<circle cx="61.4" cy="74.8" r="1.5"/>
<path d="M188.1 27.9Q189.4 31.5 186.5 34.6Q183.6 37.6 177.9 40.1Q172.1 42.5 169.5 39.3Q166.9 36.2 167.2 31.3Q167.4 26.4 170.1 25.1Q172.9 23.9 179.8 24.0Q186.8 24.2 188.1 27.9Z"/>
<circle cx="138.7" cy="133.5" r="1.5"/>
<circle cx="156.7" cy="39.8" r="3.6"/>
<circle cx="63.1" cy="35.5" r="3.7"/>
<path d="M130.0 105.2Q132.3 106.3 129.2 109.1Q126.1 112.0 123.6 112.4Q121.2 112.9 117.6 112.4Q114.0 112.0 115.6 108.2Q117.2 104.4 118.8 102.7Q120.5 101.1 124.1 102.6Q127.7 104.1 130.0 105.2Z"/>
<path d="M110.0 90.0Q102.7 79.1 68.9 83.3" fill="none" strokeWidth="2.3" strokeLinecap="round"/>
<path d="M110.0 90.0Q130.8 110.1 154.2 112.9" fill="none" strokeWidth="2.4" strokeLinecap="round"/>
<path d="M1513.6 835.9Q1513.1 839.4 1512.5 843.3Q1511.8 847.1 1509.6 849.1Q1507.4 851.1 1502.6 850.1Q1497.8 849.1 1492.1 848.6Q1486.3 848.1 1487.8 845.1Q1489.3 842.1 1489.3 839.7Q1489.4 837.3 1489.3 834.3Q1489.2 831.2 1492.5 829.2Q1495.7 827.3 1502.0 828.2Q1508.2 829.2 1511.2 830.8Q1514.1 832.4 1513.6 835.9Z"/>
<circle cx="1422.8" cy="789.1" r="1.2"/>
<circle cx="1505.7" cy="878.3" r="2.7"/>
<path d="M1553.2 858.2Q1556.4 861.0 1554.1 866.5Q1551.7 872.0 1546.6 870.9Q1541.5 869.9 1536.0 869.0Q1530.6 868.1 1531.0 861.4Q1531.4 854.6 1535.0 853.7Q1538.7 852.8 1544.4 854.1Q1550.0 855.3 1553.2 858.2Z"/>
<circle cx="1450.5" cy="837.1" r="4.8"/>
<circle cx="1459.4" cy="894.1" r="3.4"/>
<circle cx="1540.4" cy="889.9" r="3.6"/>
<circle cx="1536.7" cy="778.4" r="4.8"/>
<circle cx="1519.9" cy="851.5" r="6.4"/>
<circle cx="1560.8" cy="811.0" r="1.2"/>
<circle cx="1575.3" cy="827.4" r="1.2"/>
<circle cx="1583.6" cy="782.4" r="3.8"/>
<path d="M1507.2 878.7Q1510.6 885.2 1508.8 887.9Q1507.0 890.6 1499.6 890.8Q1492.2 891.1 1489.4 888.2Q1486.6 885.3 1487.1 883.1Q1487.6 880.8 1491.6 874.7Q1495.7 868.6 1499.8 870.4Q1503.8 872.2 1507.2 878.7Z"/>
<circle cx="1584.6" cy="848.7" r="1.2"/>
<path d="M1500.0 840.0Q1475.4 846.9 1460.0 848.2" fill="none" strokeWidth="1.9" strokeLinecap="round"/>
<path d="M1500.0 840.0Q1479.2 830.3 1452.9 834.1" fill="none" strokeWidth="3.1" strokeLinecap="round"/>
<path d="M573.0 116.2Q579.3 117.6 575.0 121.8Q570.8 126.0 568.3 130.4Q565.9 134.8 561.6 136.8Q557.3 138.8 553.8 132.9Q550.4 126.9 546.1 125.5Q541.8 124.1 544.7 120.2Q547.6 116.3 550.9 115.5Q554.1 114.6 557.2 110.0Q560.3 105.3 563.0 108.4Q565.7 111.4 566.2 113.1Q566.7 114.8 573.0 116.2Z"/>
<circle cx="529.1" cy="119.5" r="6.3"/>
<circle cx="532.1" cy="115.4" r="1.5"/>
<circle cx="544.6" cy="161.7" r="1.2"/>
<path d="M611.5 94.3Q614.5 100.7 607.6 105.9Q600.6 111.1 594.1 113.0Q587.5 115.0 583.7 109.2Q580.0 103.3 581.4 98.6Q582.9 93.8 585.5 91.2Q588.2 88.6 598.3 88.2Q608.5 87.9 611.5 94.3Z"/>
<circle cx="540.7" cy="144.4" r="1.2"/>
<circle cx="581.4" cy="104.2" r="2.0"/>
<circle cx="434.3" cy="121.2" r="2.8"/>
<circle cx="578.0" cy="184.1" r="1.7"/>
<path d="M605.3 98.0Q606.5 99.9 604.9 104.2Q603.3 108.4 599.2 107.9Q595.1 107.5 593.2 105.8Q591.4 104.2 588.9 100.2Q586.3 96.2 591.3 95.0Q596.2 93.7 600.1 94.9Q604.0 96.0 605.3 98.0Z"/>
<circle cx="566.1" cy="156.2" r="1.9"/>
<circle cx="552.9" cy="92.1" r="1.4"/>
<path d="M544.0 78.2Q545.8 80.8 543.4 83.2Q541.0 85.6 537.3 86.6Q533.6 87.7 532.5 85.6Q531.4 83.6 530.4 81.0Q529.5 78.4 531.6 76.8Q533.6 75.1 537.9 75.3Q542.1 75.5 544.0 78.2Z"/>
<circle cx="555.4" cy="140.6" r="1.8"/>
<circle cx="510.8" cy="104.7" r="1.2"/>
<path d="M560.0 120.0Q563.5 101.7 604.3 86.5" fill="none" strokeWidth="3.4" strokeLinecap="round"/>
<path d="M560.0 120.0Q540.0 124.9 519.9 155.5" fill="none" strokeWidth="2.9" strokeLinecap="round"/>
<path d="M1166.0 377.2Q1169.6 381.1 1168.4 385.6Q1167.3 390.1 1163.1 392.6Q1159.0 395.1 1153.1 392.2Q1147.2 389.4 1144.4 390.3Q1141.5 391.3 1136.0 387.0Q1130.5 382.6 1134.6 379.9Q1138.7 377.2 1141.4 375.5Q1144.0 373.9 1146.5 369.0Q1149.1 364.0 1151.1 368.4Q1153.2 372.7 1157.8 373.0Q1162.4 373.3 1166.0 377.2Z"/>
<path d="M1159.7 403.4Q1160.8 407.2 1157.8 409.9Q1154.8 412.5 1151.1 414.7Q1147.3 416.9 1142.6 413.9Q1137.9 411.0 1135.6 407.3Q1133.3 403.7 1139.0 401.0Q1144.6 398.2 1151.6 398.9Q1158.5 399.5 1159.7 403.4Z"/>
<circle cx="1114.3" cy="402.5" r="2.3"/>
<circle cx="1157.8" cy="416.5" r="3.5"/>
<path d="M1168.8 346.1Q1173.8 353.9 1170.1 361.5Q1166.3 369.1 1158.1 371.4Q1149.9 373.7 1143.2 368.1Q1136.4 362.4 1133.4 352.2Q1130.4 342.0 1137.8 341.4Q1145.3 340.8 1154.5 339.5Q1163.8 338.3 1168.8 346.1Z"/>
<circle cx="1023.8" cy="274.4" r="1.2"/>
<circle cx="1123.5" cy="398.5" r="2.2"/>
<path d="M1148.2 342.0Q1150.3 345.8 1148.0 349.4Q1145.7 353.1 1140.2 352.5Q1134.6 351.9 1131.5 350.8Q1128.4 349.7 1128.8 346.4Q1129.3 343.0 1131.9 339.4Q1134.5 335.7 1140.3 337.0Q1146.1 338.2 1148.2 342.0Z"/>
<circle cx="1074.0" cy="448.8" r="2.1"/>
<circle cx="1140.7" cy="439.9" r="1.2"/>
<path d="M1169.5 399.5Q1172.0 403.3 1172.4 407.7Q1172.8 412.1 1164.0 414.4Q1155.1 416.8 1152.7 412.6Q1150.3 408.4 1147.1 403.5Q1143.9 398.7 1151.3 395.6Q1158.6 392.5 1162.8 394.1Q1167.0 395.8 1169.5 399.5Z"/>
<circle cx="1196.5" cy="444.8" r="4.3"/>
<circle cx="1193.2" cy="388.7" r="4.1"/>
<circle cx="1201.4" cy="439.0" r="5.9"/>
<circle cx="1147.8" cy="413.6" r="1.2"/>
<circle cx="1143.5" cy="413.6" r="2.6"/>
<circle cx="1202.9" cy="320.7" r="1.2"/>
<circle cx="1138.6" cy="422.0" r="1.2"/>
<circle cx="1204.0" cy="388.4" r="5.0"/>
<path d="M1150.0 380.0Q1136.8 357.7 1085.5 351.6" fill="none" strokeWidth="3.2" strokeLinecap="round"/>
<path d="M1150.0 380.0Q1175.4 376.7 1185.6 360.1" fill="none" strokeWidth="3.9" strokeLinecap="round"/>
<circle cx="933.5" cy="835.6" r="2.9"/>
<circle cx="900.9" cy="823.4" r="1.2"/>
<circle cx="892.9" cy="833.4" r="1.7"/>
<circle cx="971.2" cy="863.7" r="2.5"/>
<circle cx="870.8" cy="809.3" r="1.4"/>
<circle cx="1004.4" cy="849.2" r="2.0"/>
<circle cx="875.5" cy="828.9" r="6.0"/>
<circle cx="856.4" cy="774.4" r="5.8"/>
<circle cx="989.3" cy="808.6" r="1.2"/>
<circle cx="886.8" cy="829.6" r="1.2"/>
<circle cx="857.9" cy="802.0" r="1.9"/>
<circle cx="928.9" cy="851.2" r="1.2"/>
<circle cx="887.5" cy="860.8" r="1.5"/>
<circle cx="898.6" cy="744.4" r="1.2"/>
<circle cx="859.2" cy="882.8" r="3.9"/>
<circle cx="958.2" cy="789.3" r="5.1"/>
<circle cx="849.3" cy="850.5" r="2.5"/>
<path d="M930.0 800.0Q939.9 827.0 919.5 863.5" fill="none" strokeWidth="3.8" strokeLinecap="round"/>
<path d="M930.0 800.0Q946.4 796.3 962.2 807.9" fill="none" strokeWidth="2.4" strokeLinecap="round"/>
<circle cx="57.2" cy="183.6" r="6.1"/>
<circle cx="94.7" cy="160.3" r="1.4"/>
<circle cx="10.2" cy="161.2" r="5.6"/>
<path d="M77.9 108.6Q81.6 113.1 80.4 120.3Q79.1 127.4 69.1 131.0Q59.0 134.5 54.4 128.7Q49.9 123.0 50.5 115.7Q51.2 108.3 57.3 104.4Q63.4 100.4 68.8 102.3Q74.2 104.2 77.9 108.6Z"/>
<circle cx="11.0" cy="157.5" r="1.2"/>
<circle cx="63.4" cy="177.5" r="6.5"/>
<circle cx="1.7" cy="164.7" r="1.2"/>
<circle cx="58.8" cy="139.0" r="1.6"/>
<path d="M17.9 156.5Q20.9 158.3 18.2 161.0Q15.5 163.7 11.8 165.8Q8.0 167.8 6.0 164.7Q4.0 161.7 3.2 157.9Q2.4 154.1 5.4 153.1Q8.5 152.1 11.7 153.3Q15.0 154.6 17.9 156.5Z"/>
<path d="M40.0 160.0Q39.0 133.5 0.3 136.3" fill="none" strokeWidth="3.2" strokeLinecap="round"/>
<path d="M40.0 160.0Q19.7 186.3 7.7 177.9" fill="none" strokeWidth="4.0" strokeLinecap="round"/>
<circle cx="189.4" cy="38.2" r="1.4"/>
<circle cx="1170.0" cy="894.3" r="1.1"/>
<circle cx="528.1" cy="23.9" r="2.0"/>
<circle cx="1341.9" cy="255.4" r="1.7"/>
<circle cx="988.4" cy="688.8" r="3.0"/>
<circle cx="873.5" cy="720.2" r="1.1"/>
<circle cx="280.1" cy="96.4" r="2.9"/>
<circle cx="415.3" cy="46.1" r="0.9"/>
<circle cx="1428.2" cy="278.4" r="1.0"/>
<circle cx="1595.5" cy="182.0" r="2.7"/>
<circle cx="1291.2" cy="356.3" r="0.9"/>
<circle cx="880.9" cy="591.2" r="2.2"/>
<circle cx="1383.4" cy="894.9" r="1.8"/>
<circle cx="281.4" cy="24.1" r="1.2"/>
<circle cx="190.0" cy="67.2" r="1.6"/>
<circle cx="1205.7" cy="279.0" r="1.9"/>
<circle cx="16.8" cy="189.1" r="2.9"/>
<circle cx="1176.6" cy="359.3" r="2.6"/>
<circle cx="1577.5" cy="90.8" r="2.9"/>
<circle cx="1297.2" cy="328.2" r="2.2"/>
<circle cx="1448.2" cy="289.5" r="1.0"/>
<circle cx="874.0" cy="612.2" r="1.2"/>
<circle cx="169.3" cy="128.6" r="1.6"/>
<circle cx="689.2" cy="8.5" r="1.9"/>
<circle cx="859.4" cy="857.1" r="1.3"/>
<circle cx="1408.8" cy="288.8" r="2.5"/>
<circle cx="1129.7" cy="160.0" r="1.4"/>
<circle cx="1083.5" cy="852.9" r="1.5"/>
<circle cx="1583.2" cy="133.3" r="2.2"/>
<circle cx="1420.2" cy="770.7" r="2.2"/>
<circle cx="1103.7" cy="407.9" r="2.3"/>
<circle cx="916.4" cy="463.7" r="0.9"/>
<circle cx="1003.7" cy="402.1" r="2.1"/>
<circle cx="951.3" cy="838.4" r="1.1"/>
<circle cx="1180.8" cy="281.7" r="2.4"/>
<circle cx="1583.1" cy="361.9" r="2.7"/>
<circle cx="1589.9" cy="58.3" r="2.7"/>
<circle cx="1138.6" cy="225.6" r="2.6"/>
<circle cx="1384.9" cy="176.4" r="1.4"/>
<circle cx="1029.9" cy="66.2" r="2.0"/>
<circle cx="1259.4" cy="441.7" r="1.3"/>
<circle cx="160.5" cy="33.1" r="1.6"/>
</svg>
</div>
                <div className="container-site relative flex min-h-[82vh] items-end py-14 sm:py-20">
          <div className="grid w-full gap-12 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-8">
              <p className="vow-label">Goal planning · Accountability · Progress</p>
              <h1 className="vow-hero-title mt-6 max-w-5xl text-[clamp(3.6rem,9vw,8.5rem)]">
                <span className="block">Make your VOW.</span>
                <span className="block">Keep your VOW.</span>
              </h1>
            </div>
            <div className="lg:col-span-4 lg:pb-2">
              <p className="max-w-[38ch] text-base leading-[1.8] text-vow-muted sm:text-lg">
                {site.tagline} Built to move you from intention to scheduled work, then back to the evidence of what actually happened.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-6">
                <Link to="/how-it-works" className="vow-btn-primary">See how it works</Link>
                <Link to="/support" className="vow-arrow-light">Start a conversation <span aria-hidden>→</span></Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container-site py-20 sm:py-28">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-5">
            <p className="vow-label">The VOW system</p>
            <h2 className="mt-5 max-w-xl text-[clamp(2.6rem,5vw,4.7rem)] leading-[.92]">A goal is only the beginning.</h2>
          </div>
          <div className="lg:col-span-7 lg:pl-10">
            <p className="max-w-[58ch] text-xl leading-[1.65]">VOW connects planning, commitment and review into one continuous system.</p>
            <p className="mt-6 max-w-[60ch] leading-[1.8] text-vow-muted">No generic motivational feed. No plan that disappears after day one. The point is to make the next piece of work clear, give it a place to happen and learn from what you actually do.</p>
          </div>
        </div>

        <ul className="mt-14 grid gap-5 md:grid-cols-3">
          {steps.map(([n, title, body]) => (
            <li key={n} className="group border border-vow-border bg-vow-bg p-7 transition-all duration-300 hover:-translate-y-1 hover:border-vow-blue md:p-9">
              <span className="vow-label text-vow-blue">{n}</span>
              <h3 className="mt-14 text-[clamp(1.8rem,3vw,2.6rem)] leading-none">{title}</h3>
              <p className="mt-6 leading-[1.75] text-vow-muted">{body}</p>
              <span className="mt-10 block text-xl text-vow-blue transition-transform duration-300 group-hover:translate-x-2">→</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-y border-vow-border bg-vow-surface/35">
        <div className="container-site py-20 sm:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <p className="vow-label">What VOW puts together</p>
            <h2 className="mt-5 text-[clamp(2.5rem,5vw,4.5rem)] leading-[.92]">From the idea in your head to the work in your week.</h2>
            <p className="mx-auto mt-6 max-w-[58ch] leading-[1.8] text-vow-muted">The system is designed around the full loop: define the outcome, build the route, schedule the sessions, do the work and review the result.</p>
          </div>

          <div className="mt-14 grid gap-px border border-vow-border bg-vow-border sm:grid-cols-2">
            {[
              ["AI-assisted planning", "Get a structured starting point without handing control of the goal away."],
              ["Sessions & reminders", "Turn milestones into concrete blocks of work you can actually show up for."],
              ["Calendar connections", "Bring planned work into the tools you already use."],
              ["Reviews & journal", "Keep a record of what happened and use it to shape what comes next."],
            ].map(([title, body]) => (
              <div key={title} className="bg-vow-bg p-7 md:p-9">
                <h3 className="text-2xl">{title}</h3>
                <p className="mt-3 max-w-[42ch] leading-[1.7] text-vow-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-vow-bg text-vow-ink">
        <div className="container-site py-20 sm:py-28">
          <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-8">
              <p className="vow-label !text-vow-ink">Built for follow-through</p>
              <h2 className="mt-5 max-w-4xl text-[clamp(3rem,7vw,6.5rem)] leading-[.86]">Less inspiration.<br />More evidence.</h2>
            </div>
            <div className="lg:col-span-4">
              <p className="leading-[1.8] text-vow-ink/70">VOW is about the part after the goal is written down: the work, the review and the decision to keep going.</p>
              <div className="mt-8"><Link to="/work" className="vow-arrow-light">Explore VOW <span aria-hidden>→</span></Link></div>
            </div>
          </div>
        </div>
      </section>

      <section className="container-site py-20 sm:py-28">
        <div className="flex flex-col gap-8 border-t border-vow-border pt-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="vow-label">Have a question?</p>
            <h2 className="mt-4 text-[clamp(2.6rem,5vw,4.5rem)] leading-[.9]">Contact us or talk to us.</h2>
          </div>
          <Link to="/support" className="vow-btn-primary">Get in touch</Link>
        </div>
      </section>
    </>
  );
}