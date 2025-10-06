@echo off
REM Start the Meeplelytics web dashboard in development mode
npm --workspace web run dev
set EXITCODE=%errorlevel%
if not %EXITCODE%==0 (
    echo.
    echo Meeplelytics web dashboard exited with error code %EXITCODE%.
    echo Press any key to close this window.
    pause >nul
    exit /b %EXITCODE%
)

echo.
echo Meeplelytics web dashboard has stopped.
echo Press any key to close this window.
pause >nul
exit /b 0
