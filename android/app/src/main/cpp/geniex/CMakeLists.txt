cmake_minimum_required(VERSION 3.22.1)
project(mais_geniex LANGUAGES CXX)

add_library(mais_geniex SHARED mais_geniex_bridge.cpp)

target_compile_features(mais_geniex PRIVATE cxx_std_17)
target_compile_options(mais_geniex PRIVATE -Wall -Wextra -Werror)

target_link_libraries(mais_geniex PRIVATE android log dl)
